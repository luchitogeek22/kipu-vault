use anchor_lang::prelude::*;

use crate::errors::KipuError;
use crate::state::{VaultState, MAX_RECIPIENTS, VAULT_SEED};

#[derive(Accounts)]
pub struct AddRecipient<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref(), vault.mint.as_ref()],
        bump = vault.bump,
        constraint = owner.key() == vault.owner @ KipuError::UnauthorizedOwner
    )]
    pub vault: Account<'info, VaultState>,
}

pub fn add_recipient_handler(ctx: Context<AddRecipient>, recipient: Pubkey) -> Result<()> {
    require!(
        recipient != Pubkey::default(),
        KipuError::InvalidPolicyConfig
    );

    let vault = &mut ctx.accounts.vault;
    let count = usize::from(vault.recipient_count);

    let existing = vault
        .allowed_recipients
        .get(..count)
        .ok_or(KipuError::MathOverflow)?;
    require!(
        !existing.contains(&recipient),
        KipuError::RecipientAlreadyExists
    );
    require!(count < MAX_RECIPIENTS, KipuError::RecipientListFull);

    let slot = vault
        .allowed_recipients
        .get_mut(count)
        .ok_or(KipuError::RecipientListFull)?;
    *slot = recipient;
    vault.recipient_count = vault
        .recipient_count
        .checked_add(1)
        .ok_or(KipuError::MathOverflow)?;

    Ok(())
}
