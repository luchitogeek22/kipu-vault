use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::errors::KipuError;
use crate::state::{VaultState, VAULT_SEED};

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub owner: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, vault.owner.as_ref(), vault.mint.as_ref()],
        bump = vault.bump,
        constraint = owner.key() == vault.owner @ KipuError::UnauthorizedOwner
    )]
    pub vault: Account<'info, VaultState>,

    #[account(address = vault.mint @ KipuError::InvalidMint)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = owner_token_account.mint == vault.mint @ KipuError::InvalidMint,
        constraint = owner_token_account.owner == owner.key() @ KipuError::UnauthorizedOwner
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn deposit_handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, KipuError::InvalidAmount);

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.owner_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)
}
