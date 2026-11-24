use anchor_lang::prelude::*;

use crate::errors::KipuError;
use crate::state::{VaultState, VAULT_SEED};

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref(), vault.mint.as_ref()],
        bump = vault.bump,
        constraint = owner.key() == vault.owner @ KipuError::UnauthorizedOwner
    )]
    pub vault: Account<'info, VaultState>,
}

pub fn update_policy_handler(
    ctx: Context<UpdatePolicy>,
    new_agent: Option<Pubkey>,
    new_max_per_tx: Option<u64>,
    new_daily_limit: Option<u64>,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    let candidate_agent = new_agent.unwrap_or(vault.agent);
    let candidate_max = new_max_per_tx.unwrap_or(vault.max_per_tx);
    let candidate_daily = new_daily_limit.unwrap_or(vault.daily_limit);

    require!(candidate_max > 0, KipuError::InvalidPolicyConfig);
    require!(
        candidate_daily >= candidate_max,
        KipuError::InvalidPolicyConfig
    );
    require!(
        candidate_agent != vault.owner,
        KipuError::InvalidPolicyConfig
    );
    require!(
        candidate_agent != Pubkey::default(),
        KipuError::InvalidPolicyConfig
    );

    vault.agent = candidate_agent;
    vault.max_per_tx = candidate_max;
    vault.daily_limit = candidate_daily;

    Ok(())
}
