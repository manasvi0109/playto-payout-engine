"""
Merchant and BankAccount models.

A Merchant is a freelancer or agency using Playto to receive international payments.
A BankAccount is where we send their INR payouts.

Design decisions:
- Merchant is kept simple — no auth here (would be separate User model in real app)
- BankAccount has is_active flag for soft-delete (never hard-delete financial data)
- One merchant can have multiple bank accounts
"""

from django.db import models


class Merchant(models.Model):
    """
    Represents a business/freelancer using Playto Pay.
    
    In a real system, this would be linked to a User model with auth.
    For this assignment, we keep it simple — identify merchants by ID.
    """
    name = models.CharField(
        max_length=255,
        help_text="Business or individual name"
    )
    email = models.EmailField(
        unique=True,
        help_text="Primary contact email"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['id']
    
    def __str__(self):
        return f"Merchant #{self.id}: {self.name}"


class BankAccount(models.Model):
    """
    Indian bank account where payouts are sent.
    
    In production:
    - account_number would be encrypted at rest
    - IFSC codes would be validated against RBI's list
    - We'd store beneficiary name for bank verification
    """
    merchant = models.ForeignKey(
        Merchant,
        on_delete=models.CASCADE,  # If merchant deleted, delete their accounts
        related_name='bank_accounts',  # merchant.bank_accounts.all()
        help_text="The merchant who owns this bank account"
    )
    account_number = models.CharField(
        max_length=20,
        help_text="Indian bank account number"
    )
    ifsc_code = models.CharField(
        max_length=11,
        help_text="IFSC code (11 characters, e.g., SBIN0001234)"
    )
    nickname = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Friendly name like 'Business Account' or 'Savings'"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Soft delete flag — inactive accounts can't receive payouts"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['id']
    
    def __str__(self):
        return f"Account {self.account_number[-4:]} ({self.ifsc_code}) - {self.merchant.name}"