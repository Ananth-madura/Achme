-- Migration script to alter all terms and conditions columns to TEXT to prevent truncation errors
ALTER TABLE `quotations` MODIFY COLUMN `terms_general` LONGTEXT DEFAULT NULL;
ALTER TABLE `quotations` MODIFY COLUMN `terms_tax` LONGTEXT DEFAULT NULL;
ALTER TABLE `quotations` MODIFY COLUMN `terms_project_period` LONGTEXT DEFAULT NULL;
ALTER TABLE `quotations` MODIFY COLUMN `terms_validity` LONGTEXT DEFAULT NULL;
ALTER TABLE `quotations` MODIFY COLUMN `terms_separate_orders` LONGTEXT DEFAULT NULL;
ALTER TABLE `quotations` MODIFY COLUMN `terms_payment` LONGTEXT DEFAULT NULL;
ALTER TABLE `quotations` MODIFY COLUMN `terms_payment_custom` LONGTEXT DEFAULT NULL;
ALTER TABLE `quotations` MODIFY COLUMN `terms_warranty` LONGTEXT DEFAULT NULL;
ALTER TABLE `quotations` MODIFY COLUMN `custom_terms` LONGTEXT DEFAULT NULL;

ALTER TABLE `performainvoices` MODIFY COLUMN `terms_general` LONGTEXT DEFAULT NULL;
ALTER TABLE `performainvoices` MODIFY COLUMN `terms_tax` LONGTEXT DEFAULT NULL;
ALTER TABLE `performainvoices` MODIFY COLUMN `terms_project_period` LONGTEXT DEFAULT NULL;
ALTER TABLE `performainvoices` MODIFY COLUMN `terms_validity` LONGTEXT DEFAULT NULL;
ALTER TABLE `performainvoices` MODIFY COLUMN `terms_separate_orders` LONGTEXT DEFAULT NULL;
ALTER TABLE `performainvoices` MODIFY COLUMN `terms_payment` LONGTEXT DEFAULT NULL;
ALTER TABLE `performainvoices` MODIFY COLUMN `terms_payment_custom` LONGTEXT DEFAULT NULL;
ALTER TABLE `performainvoices` MODIFY COLUMN `terms_warranty` LONGTEXT DEFAULT NULL;
ALTER TABLE `performainvoices` MODIFY COLUMN `custom_terms` LONGTEXT DEFAULT NULL;

ALTER TABLE `services` MODIFY COLUMN `terms_general` LONGTEXT DEFAULT NULL;
ALTER TABLE `services` MODIFY COLUMN `terms_tax` LONGTEXT DEFAULT NULL;
ALTER TABLE `services` MODIFY COLUMN `terms_project_period` LONGTEXT DEFAULT NULL;
ALTER TABLE `services` MODIFY COLUMN `terms_validity` LONGTEXT DEFAULT NULL;
ALTER TABLE `services` MODIFY COLUMN `terms_separate_orders` LONGTEXT DEFAULT NULL;
ALTER TABLE `services` MODIFY COLUMN `terms_payment` LONGTEXT DEFAULT NULL;
ALTER TABLE `services` MODIFY COLUMN `terms_payment_custom` LONGTEXT DEFAULT NULL;
ALTER TABLE `services` MODIFY COLUMN `terms_warranty` LONGTEXT DEFAULT NULL;
ALTER TABLE `services` MODIFY COLUMN `custom_terms` LONGTEXT DEFAULT NULL;

ALTER TABLE `service_estimations` MODIFY COLUMN `terms_general` LONGTEXT DEFAULT NULL;
ALTER TABLE `service_estimations` MODIFY COLUMN `terms_tax` LONGTEXT DEFAULT NULL;
ALTER TABLE `service_estimations` MODIFY COLUMN `terms_project_period` LONGTEXT DEFAULT NULL;
ALTER TABLE `service_estimations` MODIFY COLUMN `terms_validity` LONGTEXT DEFAULT NULL;
ALTER TABLE `service_estimations` MODIFY COLUMN `terms_separate_orders` LONGTEXT DEFAULT NULL;
ALTER TABLE `service_estimations` MODIFY COLUMN `terms_payment` LONGTEXT DEFAULT NULL;
ALTER TABLE `service_estimations` MODIFY COLUMN `terms_payment_custom` LONGTEXT DEFAULT NULL;
ALTER TABLE `service_estimations` MODIFY COLUMN `terms_warranty` LONGTEXT DEFAULT NULL;
ALTER TABLE `service_estimations` MODIFY COLUMN `custom_terms` LONGTEXT DEFAULT NULL;

ALTER TABLE `estimate_invoices` MODIFY COLUMN `terms_general` LONGTEXT DEFAULT NULL;
ALTER TABLE `estimate_invoices` MODIFY COLUMN `terms_tax` LONGTEXT DEFAULT NULL;
ALTER TABLE `estimate_invoices` MODIFY COLUMN `terms_project_period` LONGTEXT DEFAULT NULL;
ALTER TABLE `estimate_invoices` MODIFY COLUMN `terms_validity` LONGTEXT DEFAULT NULL;
ALTER TABLE `estimate_invoices` MODIFY COLUMN `terms_separate_orders` LONGTEXT DEFAULT NULL;
ALTER TABLE `estimate_invoices` MODIFY COLUMN `terms_payment` LONGTEXT DEFAULT NULL;
ALTER TABLE `estimate_invoices` MODIFY COLUMN `terms_payment_custom` LONGTEXT DEFAULT NULL;
ALTER TABLE `estimate_invoices` MODIFY COLUMN `terms_warranty` LONGTEXT DEFAULT NULL;
ALTER TABLE `estimate_invoices` MODIFY COLUMN `custom_terms` LONGTEXT DEFAULT NULL;
