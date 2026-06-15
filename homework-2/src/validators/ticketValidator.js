const joi = require('joi');

const baseTicketSchema = {
  customer_id: joi.string().required(),
  customer_email: joi.string().email().required(),
  customer_name: joi.string().required(),
  subject: joi.string().min(1).max(200).required(),
  description: joi.string().min(10).max(2000).required(),
  category: joi
    .string()
    .valid('account_access', 'technical_issue', 'billing_question', 'feature_request', 'bug_report', 'other')
    .default('other'),
  priority: joi
    .string()
    .valid('urgent', 'high', 'medium', 'low')
    .default('medium'),
  status: joi
    .string()
    .valid('new', 'in_progress', 'waiting_customer', 'resolved', 'closed')
    .default('new'),
  created_at: joi.date().optional(),
  updated_at: joi.date().optional(),
  resolved_at: joi.date().allow(null).optional(),
  assigned_to: joi.string().allow(null).optional(),
  tags: joi.array().items(joi.string()).default([]),
  metadata: joi.object({
    source: joi.string().valid('web_form', 'email', 'api', 'chat', 'phone').optional(),
    browser: joi.string().optional(),
    device_type: joi.string().valid('desktop', 'mobile', 'tablet').optional(),
  }).optional(),
};

const createTicketSchema = joi.object(baseTicketSchema);

const updateTicketSchema = joi.object({
  id: joi.string().uuid().required(),
  ...baseTicketSchema,
});

function validate(data) {
  return createTicketSchema.validate(data, { abortEarly: false, allowUnknown: false });
}

function validateForUpdate(data) {
  return updateTicketSchema.validate(data, { abortEarly: false, allowUnknown: false });
}

module.exports = {
  validate,
  validateForUpdate,
};
