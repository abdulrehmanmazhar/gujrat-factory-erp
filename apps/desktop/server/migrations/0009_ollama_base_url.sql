ALTER TABLE `user_ai_provider_settings` ADD `ollama_base_url` text DEFAULT 'http://127.0.0.1:11434' NOT NULL;--> statement-breakpoint
UPDATE `user_ai_provider_settings` SET `ollama_base_url` = 'http://127.0.0.1:' || CAST(`ollama_port` AS TEXT);
