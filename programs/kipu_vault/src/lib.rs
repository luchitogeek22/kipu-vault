use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("KipuVau1t1111111111111111111111111111111111");

#[program]
pub mod kipu_vault {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        agent: Pubkey,
        max_per_tx: u64,
        daily_limit: u64,
    ) -> Result<()> {
        instructions::initialize_vault::initialize_vault_handler(ctx, agent, max_per_tx, daily_limit)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::deposit_handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::withdraw_handler(ctx, amount)
    }

    pub fn agent_execute(
        ctx: Context<AgentExecute>,
        amount: u64,
        decision_hash: [u8; 32],
    ) -> Result<()> {
        instructions::agent_execute::agent_execute_handler(ctx, amount, decision_hash)
    }

    pub fn update_policy(
        ctx: Context<UpdatePolicy>,
        new_agent: Option<Pubkey>,
        new_max_per_tx: Option<u64>,
        new_daily_limit: Option<u64>,
    ) -> Result<()> {
        instructions::update_policy::update_policy_handler(
            ctx,
            new_agent,
            new_max_per_tx,
            new_daily_limit,
        )
    }

    pub fn emergency_freeze(ctx: Context<EmergencyFreeze>, freeze: bool) -> Result<()> {
        instructions::emergency_freeze::emergency_freeze_handler(ctx, freeze)
    }

    pub fn add_recipient(ctx: Context<AddRecipient>, recipient: Pubkey) -> Result<()> {
        instructions::add_recipient::add_recipient_handler(ctx, recipient)
    }

    pub fn remove_recipient(ctx: Context<RemoveRecipient>, recipient: Pubkey) -> Result<()> {
        instructions::remove_recipient::remove_recipient_handler(ctx, recipient)
    }
}
