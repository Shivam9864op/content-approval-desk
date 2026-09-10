const PLATFORM_LIMITS = {
  instagram: { caption: 2200, hashtags: 8 },
  facebook: { caption: 63206, hashtags: 10 },
  linkedin: { caption: 3000, hashtags: 5 },
  google_business: { caption: 1500, hashtags: 5 },
};

export const ALLOWED_PLATFORMS = Object.keys(PLATFORM_LIMITS);
export const ITEM_STATES = ['needs_changes', 'ready_for_approval', 'approved', 'changes_requested'];

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseSchedule(value, label) {
  if (!value) return { value: null, error: `${label} is required` };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return { value: null, error: `${label} must be an ISO date` };
  return { value: parsed.toISOString(), error: null };
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function countHashtags(value) {
  return value.match(/(^|\s)#\w+/g)?.length ?? 0;
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,\s]+/).map(text).filter(Boolean);
  return [];
}

export function normalizeCampaign(input) {
  assert(input && typeof input === 'object', 'campaign must be an object');
  const campaignId = text(input.campaignId);
  const name = text(input.name);
  assert(campaignId, 'campaignId is required');
  assert(name, 'name is required');
  assert(Array.isArray(input.items) && input.items.length > 0, 'at least one content item is required');

  const items = input.items.map((raw, index) => {
    const missingId = !text(raw?.id);
    const id = text(raw?.id) || `item-${index + 1}`;
    const schedule = parseSchedule(raw?.scheduledAt, `${id}.scheduledAt`);
    return {
      id,
      missingId,
      platform: text(raw?.platform).toLowerCase(),
      hook: text(raw?.hook),
      caption: text(raw?.caption),
      cta: text(raw?.cta),
      asset: text(raw?.asset),
      altText: text(raw?.altText),
      destinationUrl: text(raw?.destinationUrl) || text(input.destinationUrl),
      scheduledAt: schedule.value,
      scheduleError: schedule.error,
      tags: normalizeTags(raw?.tags),
      owner: text(raw?.owner) || 'content-team',
    };
  });

  return {
    campaignId,
    name,
    objective: text(input.objective) || 'consistent, reviewable publishing',
    destinationUrl: text(input.destinationUrl),
    items,
    decisions: input.decisions && typeof input.decisions === 'object' ? input.decisions : {},
  };
}

export function lintItem(item) {
  const issues = [];
  const warnings = [];
  const limits = PLATFORM_LIMITS[item.platform];

  if (item.missingId) issues.push('id is required');
  if (!limits) issues.push(`unsupported platform: ${item.platform || '(missing)'}`);
  if (!item.hook) issues.push('hook is required');
  if (!item.caption) issues.push('caption is required');
  if (!item.cta) issues.push('cta is required');
  if (!item.asset) issues.push('asset is required');
  if (!item.altText) issues.push('altText is required for review and accessibility');
  if (item.scheduleError) issues.push(item.scheduleError);
  if (!item.destinationUrl) issues.push('destinationUrl is required');
  else if (!isHttpUrl(item.destinationUrl)) issues.push('destinationUrl must be a valid http(s) URL');

  if (limits && item.caption.length > limits.caption) {
    issues.push(`caption exceeds ${limits.caption} characters for ${item.platform}`);
  }
  if (limits && countHashtags(item.caption) > limits.hashtags) {
    warnings.push(`more than ${limits.hashtags} hashtags for ${item.platform}`);
  }
  if (item.hook && (item.hook.length < 12 || item.hook.length > 90)) {
    warnings.push('hook is outside the recommended 12–90 character range');
  }
  if (item.cta && item.cta.length < 4) warnings.push('cta is very short');
  if (/\b(guaranteed|100%|double your|#1|no risk|instant results)\b/i.test(`${item.hook} ${item.caption}`)) {
    warnings.push('claim needs evidence or human review');
  }
  if (item.asset.startsWith('http://') || item.asset.startsWith('https://')) {
    warnings.push('asset is remote; keep a reviewed local copy before publishing');
  }

  return {
    id: item.id,
    status: issues.length ? 'needs_changes' : 'ready_for_approval',
    issues,
    warnings,
    hashtagCount: countHashtags(item.caption),
  };
}

function findSlotCollisions(items) {
  const slots = new Map();
  const collisions = [];
  for (const item of items) {
    const key = `${item.platform}:${item.scheduledAt}`;
    if (!item.scheduledAt || !item.platform) continue;
    const existing = slots.get(key);
    if (existing) collisions.push({ key, platform: item.platform, scheduledAt: item.scheduledAt, itemIds: [existing, item.id] });
    else slots.set(key, item.id);
  }
  return collisions;
}

export function buildBoard(input) {
  const campaign = normalizeCampaign(input);
  const reviews = campaign.items.map((item) => lintItem(item));
  const collisions = findSlotCollisions(campaign.items);
  const collisionIds = new Set(collisions.flatMap((collision) => collision.itemIds));

  const items = campaign.items.map((item, index) => {
    const review = { ...reviews[index], issues: [...reviews[index].issues] };
    if (collisionIds.has(item.id)) review.issues.push('scheduled slot is already used by another item');
    const requested = campaign.decisions[item.id]?.state;
    const state = review.issues.length
      ? 'needs_changes'
      : ITEM_STATES.includes(requested)
        ? requested
        : 'ready_for_approval';
    return {
      ...item,
      review: { ...review, status: review.issues.length ? 'needs_changes' : review.status },
      state,
      decision: campaign.decisions[item.id] || null,
    };
  });

  return {
    campaign,
    items,
    collisions,
    reviewLink: createReviewLink({ campaign }),
    summary: {
      total: items.length,
      needsChanges: items.filter((item) => item.state === 'needs_changes').length,
      readyForApproval: items.filter((item) => item.state === 'ready_for_approval').length,
      approved: items.filter((item) => item.state === 'approved').length,
      changesRequested: items.filter((item) => item.state === 'changes_requested').length,
      collisions: collisions.length,
    },
  };
}

export function applyDecision(board, itemId, state, reviewer, note = '') {
  assert(ITEM_STATES.includes(state), `unsupported decision state: ${state}`);
  const item = board.items.find((entry) => entry.id === itemId);
  assert(item, `unknown item: ${itemId}`);
  if (state === 'approved') assert(item.review.issues.length === 0, `${itemId} still has blocking issues`);
  item.state = state;
  item.decision = {
    state,
    reviewer: text(reviewer) || 'reviewer',
    note: text(note),
    decidedAt: new Date().toISOString(),
  };
  return item;
}

export function createReviewLink(board, baseUrl = 'http://localhost:4173') {
  const id = encodeURIComponent(board.campaign.campaignId);
  return `${baseUrl.replace(/\/$/, '')}/review/${id}`;
}

export function renderBoard(board) {
  const lines = [
    `CONTENT APPROVAL DESK  |  ${board.campaign.name}`,
    `campaign=${board.campaign.campaignId}  objective=${board.campaign.objective}`,
    `review_link=${board.reviewLink}`,
    '─'.repeat(82),
    `ITEMS ${board.summary.total}  NEEDS_CHANGES ${board.summary.needsChanges}  READY ${board.summary.readyForApproval}  APPROVED ${board.summary.approved}  COLLISIONS ${board.summary.collisions}`,
  ];
  for (const item of board.items) {
    lines.push(`${item.platform.padEnd(14)} ${item.id.padEnd(14)} ${item.state.padEnd(18)} issues=${item.review.issues.length} warnings=${item.review.warnings.length}`);
    for (const issue of item.review.issues) lines.push(`  ! ${issue}`);
    for (const warning of item.review.warnings) lines.push(`  ? ${warning}`);
  }
  if (board.collisions.length) lines.push(`COLLISIONS ${JSON.stringify(board.collisions)}`);
  return lines.join('\n');
}
