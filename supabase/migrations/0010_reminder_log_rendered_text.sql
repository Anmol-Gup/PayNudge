-- reminder_log only recorded which step fired, so the invoice detail page's
-- "Reminder timeline" was showing the raw {{invoice_number}}-style template
-- text instead of what was actually emailed. Store the rendered subject and
-- body at send time so the timeline reflects the real content sent, and
-- keeps doing so even if the template is edited afterward.
alter table reminder_log
  add column rendered_subject text,
  add column rendered_body text;
