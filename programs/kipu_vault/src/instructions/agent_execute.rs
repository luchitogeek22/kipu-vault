use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::errors::KipuError;
use crate::state::{KipuAuditEvent, VaultState, VAULT_SEED, WINDOW_DURATION_SECS};

#[derive(Accounts)]
pub struct AgentExecute<'info> {
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref(), vault.mint.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, VaultState>,

    #[account(address = vault.mint @ KipuError::InvalidMint)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub destination_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn agent_execute_handler(
    ctx: Context<AgentExecute>,
    amount: u64,
    decision_hash: [u8; 32],
) -> Result<()> {
    // Deterministic check order (SPEC.md §4.3):
    // 1. agent.key() == vault.agent -> UnauthorizedAgent
    require_keys_eq!(
        ctx.accounts.agent.key(),
        ctx.accounts.vault.agent,
        KipuError::UnauthorizedAgent
    );

    // 2. !vault.is_frozen -> VaultFrozen
    require!(!ctx.accounts.vault.is_frozen, KipuError::VaultFrozen);

    // 3. amount > 0 -> InvalidAmount
    require!(amount > 0, KipuError::InvalidAmount);

    // 4. decision_hash != [0u8; 32] -> InvalidDecisionHash
    require!(decision_hash != [0u8; 32], KipuError::InvalidDecisionHash);

    // 5. destination_token.mint == vault.mint -> InvalidMint
    require_keys_eq!(
        ctx.accounts.destination_token.mint,
        ctx.accounts.vault.mint,
        KipuError::InvalidMint
    );

    // 6. destination_token.owner in allowed_recipients[..recipient_count] -> RecipientNotAllowed
    let recipient_count = usize::from(ctx.accounts.vault.recipient_count);
    let active_recipients = ctx
        .accounts
        .vault
        .allowed_recipients
        .get(..recipient_count)
        .ok_or(KipuError::MathOverflow)?;
    require!(
        active_recipients.contains(&ctx.accounts.destination_token.owner),
        KipuError::RecipientNotAllowed
    );

    // 7. amount <= max_per_tx -> ExceedsTransactionLimit
    require!(
        amount <= ctx.accounts.vault.max_per_tx,
        KipuError::ExceedsTransactionLimit
    );

    // 8. Fixed 24h window reset check
    let now = Clock::get()?.unix_timestamp;
    let elapsed = now
        .checked_sub(ctx.accounts.vault.window_start)
        .ok_or(KipuError::MathOverflow)?;
    let (effective_spent, new_window_start) = if elapsed >= WINDOW_DURATION_SECS {
        (0u64, now)
    } else {
        (ctx.accounts.vault.spent_today, ctx.accounts.vault.window_start)
    };

    // 9. spent_today.checked_add(amount) <= daily_limit
    let new_spent = effective_spent
        .checked_add(amount)
        .ok_or(KipuError::MathOverflow)?;
    require!(
        new_spent <= ctx.accounts.vault.daily_limit,
        KipuError::ExceedsDailyLimit
    );

    // 10. transfer_checked signed by PDA
    let owner_key = ctx.accounts.vault.owner;
    let mint_key = ctx.accounts.vault.mint;
    let bump = ctx.accounts.vault.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        VAULT_SEED,
        owner_key.as_ref(),
        mint_key.as_ref(),
        &[bump],
    ]];

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.vault_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.destination_token.to_account_info(),
        authority: ctx.accounts.vault.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

    let vault = &mut ctx.accounts.vault;
    vault.window_start = new_window_start;
    vault.spent_today = new_spent;
    vault.total_executions = vault
        .total_executions
        .checked_add(1)
        .ok_or(KipuError::MathOverflow)?;

    // 11. Emit informational audit event (instruction data remains canonical anchor)
    emit!(KipuAuditEvent {
        vault: vault.key(),
        agent: ctx.accounts.agent.key(),
        destination: ctx.accounts.destination_token.key(),
        amount,
        decision_hash,
        timestamp: now,
    });

    Ok(())
}
