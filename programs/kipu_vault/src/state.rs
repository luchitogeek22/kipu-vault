use anchor_lang::prelude::*;

pub const VAULT_SEED: &[u8] = b"kipu_vault";
pub const MAX_RECIPIENTS: usize = 8;
pub const WINDOW_DURATION_SECS: i64 = 86_400;

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub mint: Pubkey,
    pub max_per_tx: u64,
    pub daily_limit: u64,
    pub spent_today: u64,
    pub window_start: i64,
    pub is_frozen: bool,
    pub total_executions: u64,
    pub allowed_recipients: [Pubkey; 8],
    pub recipient_count: u8,
    pub bump: u8,
}

#[event]
pub struct KipuAuditEvent {
    pub vault: Pubkey,
    pub agent: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub decision_hash: [u8; 32],
    pub timestamp: i64,
}
