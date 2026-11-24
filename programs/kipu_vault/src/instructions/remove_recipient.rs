use anchor_lang::prelude::*;

use crate::errors::KipuError;
use crate::state::{VaultState, VAULT_SEED};

#[derive(Accounts)]
pub struct RemoveRecipient<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref(), vault.mint.as_ref()],
        bump = vault.bump,
        constraint = owner.key() == vault.owner @ KipuError::UnauthorizedOwner
    )]
    pub vault: Account<'info, VaultState>,
}

pub fn remove_recipient_handler(ctx: Context<RemoveRecipient>, recipient: Pubkey) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let count = usize::from(vault.recipient_count);

    let pos = vault
        .allowed_recipients
        .get(..count)
        .ok_or(KipuError::MathOverflow)?
        .iter()
        .position(|entry| *entry == recipient)
        .ok_or(KipuError::RecipientNotFound)?;

    let last_idx = count.checked_sub(1).ok_or(KipuError::MathOverflow)?;
    for idx in pos..last_idx {
        let next_idx = idx.checked_add(1).ok_or(KipuError::MathOverflow)?;
        vault.allowed_recipients[idx] = vault.allowed_recipients[next_idx];
    }
    vault.allowed_recipients[last_idx] = Pubkey::default();
    vault.recipient_count = vault
        .recipient_count
        .checked_sub(1)
        .ok_or(KipuError::MathOverflow)?;

    Ok(())
}
