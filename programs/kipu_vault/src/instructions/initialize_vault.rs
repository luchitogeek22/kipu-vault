use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::KipuError;
use crate::state::{VaultState, VAULT_SEED};

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = owner,
        space = 8 + VaultState::INIT_SPACE,
        seeds = [VAULT_SEED, owner.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, VaultState>,

    #[account(
        init,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = vault
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn initialize_vault_handler(
    ctx: Context<InitializeVault>,
    agent: Pubkey,
    max_per_tx: u64,
    daily_limit: u64,
) -> Result<()> {
    require!(max_per_tx > 0, KipuError::InvalidPolicyConfig);
    require!(daily_limit >= max_per_tx, KipuError::InvalidPolicyConfig);
    require!(agent != ctx.accounts.owner.key(), KipuError::InvalidPolicyConfig);
    require!(agent != Pubkey::default(), KipuError::InvalidPolicyConfig);

    let clock = Clock::get()?;
    let vault = &mut ctx.accounts.vault;
    vault.owner = ctx.accounts.owner.key();
    vault.agent = agent;
    vault.mint = ctx.accounts.mint.key();
    vault.max_per_tx = max_per_tx;
    vault.daily_limit = daily_limit;
    vault.spent_today = 0;
    vault.window_start = clock.unix_timestamp;
    vault.is_frozen = false;
    vault.total_executions = 0;
    vault.allowed_recipients = [Pubkey::default(); 8];
    vault.recipient_count = 0;
    vault.bump = ctx.bumps.vault;

    Ok(())
}
