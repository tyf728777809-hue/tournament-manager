 = params;
  const timestamp = Date.now();
  
  // 更新报名记录
  await updateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    registration_id,
    {
      registration_status: 'rejected',
      review_status: 'rejected',
      review_note: reject_reason,
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );
  
  // 发送通知
  await sendNotification(params.entity_uid, `❌ 您的报名被驳回\n原因：${reject_reason}`);
  
  return { success: true, message: '报名已驳回' };
}

/**
 * 要求补充报名资料
 * @param {Object} params - 参数
 */
async function requestRegistrationInfo(params) {
  const { registration_id, request_note } = params;
  
  // 发送补充资料请求
  await sendNotification(params.entity_uid, `💬 管理员要求补充资料\n${request_note}`);
  
  return { success: true, message: '已发送补充资料请求' };
}

// ============================================
// 6. 卡组审核处理
// ============================================

/**
 * 审核通过卡组提交
 * @param {Object} params - 参数
 */
async function approveDeckSubmission(params) {
  const { submission_id, registration_id, entity_type, admin_open_id } = params;
  const timestamp = Date.now();
  
  // 6.1 更新卡组提交记录
  await updateRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    submission_id,
    {
      submission_status: 'approved',
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
      is_current_effective_version: true,
    }
  );
  
  // 6.2 处理旧版本（如有）
  const oldVersions = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'registration_uid', operator: 'is', value: [registration_id] },
          { field_name: 'submission_status', operator: 'is', value: ['approved'] },
          { field_name: 'deck_submission_uid', operator: 'isNot', value: [submission_id] },
        ]
      }
    }
  );
  
  for (const old of oldVersions || []) {
    await updateRecord(
      CONFIG.bitable.apps.deck,
      TABLES.deckSubmissions,
      old.record_id,
      {
        is_current_effective_version: false,
        submission_status: 'superseded',
      }
    );
  }
  
  // 6.3 更新卡组可见性（对手可见）
  await updateDecksVisibility(submission_id, 'visible_for_bp');
  
  // 6.4 发送通知
  await sendNotification(params.entity_uid, '✅ 您的卡组已通过审核！');
  
  // 6.5 生成公示确认稿（根据赛事配置）
  const tournament = await getRecord(
    CONFIG.bitable.apps.operation,
    TABLES.tournaments,
    params.tournament_uid
  );
  
  if (tournament.fields.public_deck_publish_mode === 'manual_publish') {
    await generatePublishConfirmation(submission_id, params.tournament_uid);
  }
  
  return { success: true, message: '卡组审核通过' };
}

/**
 * 驳回卡组提交
 * @param {Object} params - 参数
 */
async function rejectDeckSubmission(params) {
  const { submission_id, reject_reason, admin_open_id } = params;
  const timestamp = Date.now();
  
  await updateRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    submission_id,
    {
      submission_status: 'rejected',
      validation_note: reject_reason,
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );
  
  await sendNotification(params.entity_uid, `❌ 您的卡组被驳回\n原因：${reject_reason}`);
  
  return { success: true, message: '卡组已驳回' };
}

/**
 * 公示卡组
 * @param {Object} params - 参数
 */
async function publishDecks(params) {
  const { tournament_uid, submission_ids, admin_open_id } = params;
  const timestamp = Date.now();
  
  // 批量更新卡组提交记录
  for (const submission_id of submission_ids) {
    await updateRecord(
      CONFIG.bitable.apps.deck,
      TABLES.deckSubmissions,
      submission_id,
      {
        public_publish_status: 'published',
        secrecy_status: 'public',
      }
    );
    
    // 更新卡组明细的公开可见性
    await updateDecksVisibility(submission_id, 'published', timestamp);
  }
  
  // 创建公示公告
  await createAnnouncement(tournament_uid, {
    type: 'deck_publication',
    title: '卡组公示',
    content: `本次公示共 ${submission_ids.length} 支战队卡组`,
    published_by: admin_open_id,
    published_at: timestamp,
  });
  
  // 发送群消息
  await sendGroupMessage(tournament_uid, `📢 卡组公示已发布\n共 ${submission_ids.length} 支战队`);
  
  return { success: true, message: '卡组已公示' };
}

// ============================================
// 7. 争议处理
// ============================================

/**
 * 采纳AI建议
 * @param {Object} params - 参数
 */
async function approveAIRecommendation(params) {
  const { dispute_id, ai_recommendation, admin_open_id } = params;
  const timestamp = Date.now();
  
  await updateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.disputes,
    dispute_id,
    {
      status: 'resolved',
      final_ruling: ai_recommendation,
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );
  
  // 通知双方
  await notifyDisputeParties(dispute_id, '争议已裁决', ai_recommendation);
  
  return { success: true, message: '已采纳AI建议并裁决' };
}

/**
 * 自定义裁决
 * @param {Object} params - 参数
 */
async function customRuling(params) {
  const { dispute_id, ruling, admin_open_id } = params;
  const timestamp = Date.now();
  
  await updateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.disputes,
    dispute_id,
    {
      status: 'resolved',
      final_ruling: ruling,
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );
  
  await notifyDisputeParties(dispute_id, '争议已裁决', ruling);
  
  return { success: true, message: '已自定义裁决' };
}

// ============================================
// 8. 工作台查询
// ============================================

/**
 * 列出待审核报名
 * @param {Object} params - 参数
 */
async function listPendingRegistrations(params) {
  const { tournament_uid } = params;
  
  const records = await queryRecord(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'tournament_uid', operator: 'is', value: [tournament_uid] },
          { field_name: 'registration_status', operator: 'is', value: ['submitted'] },
        ]
      },
      sort: [{ field_name: 'submitted_at', desc: false }],
    }
  );
  
  return {
    success: true,
    count: records.length,
    data: records,
  };
}

/**
 * 列出待审核卡组
 * @param {Object} params - 参数
 */
async function listPendingDecks(params) {
  const { tournament_uid } = params;
  
  const records = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'tournament_uid', operator: 'is', value: [tournament_uid] },
          { field_name: 'submission_status', operator: 'is', value: ['submitted'] },
        ]
      },
      sort: [{ field_name: 'submitted_at', desc: false }],
    }
  );
  
  return {
    success: true,
    count: records.length,
    data: records,
  };
}

/**
 * 列出待处理争议
 * @param {Object} params - 参数
 */
async function listPendingDisputes(params) {
  const { tournament_uid } = params;
  
  const records = await queryRecord(
    CONFIG.bitable.apps.operation,
    TABLES.disputes,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'tournament_uid', operator: 'is', value: [tournament_uid] },
          { field_name: 'status', operator: 'is', value: ['admin_review'] },
        ]
      },
      sort: [{ field_name: 'created_at', desc: false }],
    }
  );
  
  return {
    success: true,
    count: records.length,
    data: records,
  };
}

// ============================================
// 9. 工具函数（占位）
// ============================================

/**
 * 查询记录
 * @param {string} appToken - App Token
 * @param {string} tableId - 表ID
 * @param {Object} options -