use anchor_lang::prelude::*;

use crate::errors::KipuError;
use crate::state::{VaultState, VAULT_SEED};

#[derive(Accounts)]
pub struct EmergencyFreeze<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref(), vault.mint.as_ref()],
        bump = vault.bump,
        constraint = owner.key() == vault.owner @ KipuError::UnauthorizedOwner
    )]
    pub vault: Account<'info, VaultState>,
}

pub fn emergency_freeze_handler(ctx: Context<EmergencyFreeze>, freeze: bool) -> Result<()> {
    ctx.accounts.vault.is_frozen = freeze;
    Ok(())
}
