const ROLES = {
  CHANNEL_PARTNER: 'channel_partner',
  CUSTOMER_ONBOARDING_SPECIALIST: 'customer_onboarding_specialist',
  SENIOR_BDM: 'senior_bdm',
  MANAGER_PARTNERSHIPS: 'manager_partnerships',
  HEAD_OF_SALES: 'head_of_sales',
  HEAD_OF_MENA: 'head_of_mena'
};

const INTERNAL_ROLES = [
  ROLES.CUSTOMER_ONBOARDING_SPECIALIST,
  ROLES.SENIOR_BDM,
  ROLES.MANAGER_PARTNERSHIPS,
  ROLES.HEAD_OF_SALES,
  ROLES.HEAD_OF_MENA
];

// Roles that can see all accounts (not just their assigned ones)
const MANAGEMENT_ROLES = [
  ROLES.SENIOR_BDM,
  ROLES.MANAGER_PARTNERSHIPS,
  ROLES.HEAD_OF_SALES,
  ROLES.HEAD_OF_MENA
];

const ACCOUNT_STATUS = {
  REGISTERED: 'registered',
  IN_REVIEW: 'in_review',
  ONBOARDED: 'onboarded',
  ACTIVATED: 'activated',
  REJECTED: 'rejected'
};

const VERTICALS = {
  IT_SERVICES_PROVIDER: 'it_services_provider',
  ECOMM_SELLER: 'ecomm_seller',
  B2B_SELLER: 'b2b_seller',
  FREELANCER: 'freelancer'
};

const BUSINESS_TYPES = {
  NEW: 'new',
  ESTABLISHED: 'established'
};

const TICKET_QUERY_TYPES = [
  'Account Approval – Document Approval',
  'Account Approval – EDD Alert',
  'Account Approval – VA Issuance & Approval',
  'Account Approval – Nature of Business Review',
  'Account Approval – Funds Flow Info for Receiving and Payout',
  'Payment Review – Incoming Payment',
  'Payment Declined',
  'Payout not received in Local Bank',
  'Product Activation – Pay by Link/Card',
  'Product Information – Checkout/ Additional Currency Account/ Currency Conversion',
  'Price Reduction Request'
];

const TICKET_RESOLUTION_DAYS = [
  '2 Business Days',
  '3 Business Days',
  '1 Business Week'
];

const TICKET_STATUS = {
  OPEN: 'open',
  IN_REVIEW: 'in_review',
  PENDING_PARTNER: 'pending_partner',
  PENDING_CUSTOMER: 'pending_customer',
  RESOLVED: 'resolved',
  DECLINED: 'declined'
};

const TICKET_DECLINE_REASONS = [
  'NOB Not Supported',
  'Risk & Compliance'
];

const NOTIFICATION_TYPES = {
  NOTE: 'note',
  TICKET: 'ticket',
  ACCOUNT: 'account',
  TICKET_UPDATE: 'ticket_update'
};

const DESIGNATIONS = [
  'Business Development Manager',
  'Customer Onboarding Specialist',
  'Sales Development Representative',
  'Head of Sales',
  'Country Head',
  'Head of MENA',
  'Senior Business Development Manager',
  'Manager Partnerships'
];

module.exports = {
  ROLES,
  INTERNAL_ROLES,
  MANAGEMENT_ROLES,
  ACCOUNT_STATUS,
  VERTICALS,
  BUSINESS_TYPES,
  TICKET_QUERY_TYPES,
  TICKET_RESOLUTION_DAYS,
  TICKET_STATUS,
  TICKET_DECLINE_REASONS,
  NOTIFICATION_TYPES,
  DESIGNATIONS
};
