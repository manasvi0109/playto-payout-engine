"""
Management command to seed the database with test data.

Run with: python manage.py seed_data

This creates:
- 3 merchants with different balance levels
- 1 bank account per merchant
- 5-10 credit entries per merchant (simulating received payments)

WHY pre-seed?
- Evaluators can immediately see the dashboard working
- Don't need to manually create test data
- Demonstrates the ledger system with realistic data
"""

import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.merchants.models import Merchant, BankAccount
from apps.ledger.models import LedgerEntry


class Command(BaseCommand):
    help = 'Seed database with test merchants, bank accounts, and ledger entries'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing data...')
            LedgerEntry.objects.all().delete()
            BankAccount.objects.all().delete()
            Merchant.objects.all().delete()
            self.stdout.write(self.style.WARNING('All data cleared.'))

        self.stdout.write('Seeding database...\n')

        # Define test merchants
        merchants_data = [
            {
                'name': 'Acme Design Studio',
                'email': 'billing@acmedesign.in',
                'bank': {
                    'account_number': '1234567890',
                    'ifsc_code': 'SBIN0001234',
                    'nickname': 'Business Current Account',
                },
                'credits': [
                    (500000, 'Payment from ClientCorp - Logo Design'),
                    (750000, 'Payment from TechStartup Inc - Website Redesign'),
                    (250000, 'Payment from GlobalBiz - Social Media Pack'),
                    (1000000, 'Payment from MegaCorp - Brand Identity'),
                    (350000, 'Payment from StartupXYZ - UI/UX Design'),
                    (600000, 'Payment from FinanceHub - Dashboard Design'),
                    (450000, 'Payment from EduTech - Mobile App Design'),
                ],
            },
            {
                'name': 'DevForge Solutions',
                'email': 'payments@devforge.io',
                'bank': {
                    'account_number': '9876543210',
                    'ifsc_code': 'HDFC0002345',
                    'nickname': 'Savings Account',
                },
                'credits': [
                    (1500000, 'Payment from CloudNine - API Development'),
                    (2000000, 'Payment from DataDriven - ML Pipeline'),
                    (800000, 'Payment from AppFactory - Backend Services'),
                    (1200000, 'Payment from SecureNet - Auth System'),
                    (950000, 'Payment from ScaleUp - Microservices'),
                ],
            },
            {
                'name': 'Priya Sharma Consulting',
                'email': 'priya@psconsulting.com',
                'bank': {
                    'account_number': '5555666677',
                    'ifsc_code': 'ICIC0003456',
                    'nickname': 'Primary Account',
                },
                'credits': [
                    (300000, 'Payment from StartupA - Strategy Consulting'),
                    (450000, 'Payment from GrowthCo - Market Research'),
                    (200000, 'Payment from InnovateTech - Product Advisory'),
                    (550000, 'Payment from VentureFund - Due Diligence Report'),
                    (375000, 'Payment from ScaleEd - Curriculum Design'),
                    (280000, 'Payment from HealthTech - Regulatory Consulting'),
                    (420000, 'Payment from RetailPro - Operations Review'),
                    (600000, 'Payment from FinServ - Compliance Audit'),
                ],
            },
        ]

        for merchant_data in merchants_data:
            # Create merchant (or get if already exists)
            merchant, created = Merchant.objects.get_or_create(
                email=merchant_data['email'],
                defaults={'name': merchant_data['name']},
            )
            action = 'Created' if created else 'Already exists'
            self.stdout.write(f'  {action}: {merchant.name}')

            # Create bank account
            bank_data = merchant_data['bank']
            bank_account, created = BankAccount.objects.get_or_create(
                merchant=merchant,
                account_number=bank_data['account_number'],
                defaults={
                    'ifsc_code': bank_data['ifsc_code'],
                    'nickname': bank_data['nickname'],
                },
            )
            if created:
                self.stdout.write(f'    Bank account: {bank_account}')

            # Create credit ledger entries (only if merchant was just created)
            if created or not merchant.ledger_entries.exists():
                for i, (amount, description) in enumerate(merchant_data['credits']):
                    # Stagger the entries over the past 30 days
                    days_ago = len(merchant_data['credits']) - i
                    entry = LedgerEntry.objects.create(
                        merchant=merchant,
                        entry_type='credit',
                        amount_paise=amount,  # Positive for credits
                        description=description,
                        created_at=timezone.now() - timedelta(days=days_ago),
                    )

                balance = LedgerEntry.get_balance(merchant.id)
                self.stdout.write(
                    f'    Ledger entries: {len(merchant_data["credits"])} credits, '
                    f'Balance: ₹{balance / 100:,.2f}'
                )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('✅ Seed data created successfully!'))
        self.stdout.write('')
        
        # Print summary
        self.stdout.write('Summary:')
        for merchant in Merchant.objects.all():
            balance = LedgerEntry.get_balance(merchant.id)
            entry_count = merchant.ledger_entries.count()
            bank_count = merchant.bank_accounts.count()
            self.stdout.write(
                f'  {merchant.name}: '
                f'Balance=₹{balance / 100:,.2f} | '
                f'Entries={entry_count} | '
                f'Bank Accounts={bank_count}'
            )