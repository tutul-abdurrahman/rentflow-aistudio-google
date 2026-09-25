import type { ComponentType } from 'react';

import Dashboard from '../screens/02-dashboard';
import Login from '../screens/01-login';
import Signup from '../screens/05-signup';
import ForgotPassword from '../screens/06-forgot-password';
import Onboarding from '../screens/07-onboarding';
import OnboardingSuccess from '../screens/08-onboarding-success';
import MeterEntry from '../screens/03-meter-entry';
import BillPreview from '../screens/17-bill-preview';
import ReceiptGridPrint from '../screens/04-receipt-grid-print';
import SingleReceipt from '../screens/21-single-receipt';
import ManualAdjustment from '../screens/18-manual-adjustment';
import BillCreated from '../screens/33-bill-created';
import CollectionDueList from '../screens/19-collection-due-list';
import PaymentSuccess from '../screens/20-payment-success';
import TenantList from '../screens/09-tenant-list';
import AddTenant from '../screens/10-add-tenant';
import VacatedArchive from '../screens/15-vacated-archive';
import TenantProfile from '../screens/11-tenant-profile';
import EditTenant from '../screens/12-edit-tenant';
import ShiftRoom from '../screens/13-shift-room';
import MoveOut from '../screens/14-move-out';
import TenantHistory from '../screens/16-tenant-history';
import LoanList from '../screens/23-loan-list';
import AddLoan from '../screens/24-add-loan';
import LoanDetail from '../screens/25-loan-detail';
import IncomeExpenseList from '../screens/26-income-expense-list';
import AddIncomeExpense from '../screens/27-add-income-expense';
import CashflowSummary from '../screens/28-cashflow-summary';
import MonthlySummaryLedger from '../screens/22-monthly-summary-ledger';
import SettingsHub from '../screens/29-settings-hub';
import RoomsManagement from '../screens/30-rooms-management';
import PropertyManagement from '../screens/31-property-management';
import Profile from '../screens/32-profile';

/** Which chrome a route renders. */
export type ShellKind = 'app' | 'bare';

export interface AppRoute {
  path: string;
  Component: ComponentType;
  shell: ShellKind;
}

/**
 * Route table — handoff §15 screen index.
 * `bare` = no nav (auth / onboarding / print / success); everything else uses
 * the sidebar + bottom-nav shell. Unknown paths redirect to '/'.
 */
export const routes: AppRoute[] = [
  { path: '/', Component: Dashboard, shell: 'app' },

  // auth / onboarding
  { path: '/login', Component: Login, shell: 'bare' },
  { path: '/signup', Component: Signup, shell: 'bare' },
  { path: '/forgot-password', Component: ForgotPassword, shell: 'bare' },
  { path: '/onboarding', Component: Onboarding, shell: 'bare' },
  { path: '/onboarding/success', Component: OnboardingSuccess, shell: 'bare' },

  // monthly cycle
  { path: '/bills/meters', Component: MeterEntry, shell: 'app' },
  { path: '/bills/preview', Component: BillPreview, shell: 'app' },
  { path: '/bills/print', Component: ReceiptGridPrint, shell: 'bare' },
  { path: '/bills/reprint/:tenantId?', Component: SingleReceipt, shell: 'bare' },
  { path: '/bills/adjustments', Component: ManualAdjustment, shell: 'app' },
  { path: '/bills/ready', Component: BillCreated, shell: 'bare' },
  { path: '/collection', Component: CollectionDueList, shell: 'app' },
  { path: '/collection/success', Component: PaymentSuccess, shell: 'bare' },

  // tenants
  { path: '/tenants', Component: TenantList, shell: 'app' },
  { path: '/tenants/add', Component: AddTenant, shell: 'app' },
  { path: '/tenants/archive', Component: VacatedArchive, shell: 'app' },
  { path: '/tenants/:id', Component: TenantProfile, shell: 'app' },
  { path: '/tenants/:id/edit', Component: EditTenant, shell: 'app' },
  { path: '/tenants/:id/shift', Component: ShiftRoom, shell: 'app' },
  { path: '/tenants/:id/move-out', Component: MoveOut, shell: 'app' },
  { path: '/tenants/:id/history', Component: TenantHistory, shell: 'app' },

  // loan
  { path: '/loans', Component: LoanList, shell: 'app' },
  { path: '/loans/add', Component: AddLoan, shell: 'app' },
  { path: '/loans/:id', Component: LoanDetail, shell: 'app' },

  // finance
  { path: '/finance', Component: IncomeExpenseList, shell: 'app' },
  { path: '/finance/add', Component: AddIncomeExpense, shell: 'app' },
  { path: '/finance/cashflow', Component: CashflowSummary, shell: 'app' },

  // summary
  { path: '/summary', Component: MonthlySummaryLedger, shell: 'app' },

  // settings
  { path: '/more', Component: SettingsHub, shell: 'app' },
  { path: '/settings/rooms', Component: RoomsManagement, shell: 'app' },
  { path: '/settings/property', Component: PropertyManagement, shell: 'app' },
  { path: '/profile', Component: Profile, shell: 'app' },
];
