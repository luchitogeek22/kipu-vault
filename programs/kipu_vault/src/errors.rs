use anchor_lang::prelude::*;

#[error_code]
pub enum KipuError {
    #[msg("Only the vault owner is authorized to perform this action")]
    UnauthorizedOwner, // 6000
    #[msg("Only the configured agent is authorized to execute payments")]
    UnauthorizedAgent, // 6001
    #[msg("Vault is currently frozen for agent executions")]
    VaultFrozen, // 6002
    #[msg("Amount exceeds maximum per transaction limit")]
    ExceedsTransactionLimit, // 6003
    #[msg("Amount exceeds 24-hour daily spending limit")]
    ExceedsDailyLimit, // 6004
    #[msg("Invalid vault policy configuration")]
    InvalidPolicyConfig, // 6005
    #[msg("Amount must be greater than zero")]
    InvalidAmount, // 6006
    #[msg("Arithmetic overflow occurred")]
    MathOverflow, // 6007
    #[msg("Destination token owner is not in the vault allowlist")]
    RecipientNotAllowed, // 6008
    #[msg("Allowed recipients list is full (maximum 8)")]
    RecipientListFull, // 6009
    #[msg("Recipient is already in the allowlist")]
    RecipientAlreadyExists, // 6010
    #[msg("Recipient was not found in the allowlist")]
    RecipientNotFound, // 6011
    #[msg("Decision hash must not be all zeros")]
    InvalidDecisionHash, // 6012
    #[msg("Token account mint does not match vault mint")]
    InvalidMint, // 6013
}
