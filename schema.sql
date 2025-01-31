-- Drop existing tables in reverse order of dependencies
DROP TABLE IF EXISTS copilot.opportunities;
DROP TABLE IF EXISTS copilot.messages;
DROP TABLE IF EXISTS copilot.relationships;
DROP TABLE IF EXISTS copilot.accounts;
DROP TABLE IF EXISTS copilot.tenants;

-- Create tables
CREATE TABLE copilot.tenants (
    id          BIGINT(10) NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255)       DEFAULT null,
    email       VARCHAR(255)       DEFAULT null,
    description TEXT               DEFAULT NULL,
    logo_url    TEXT               DEFAULT NULL,
    status      ENUM('Active','Deleted') NOT NULL DEFAULT 'Active',
    created_at  TIMESTAMP NOT NULL DEFAULT current_timestamp(),
    updated_at  TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (id)
);

CREATE TABLE copilot.accounts (
    id                       BIGINT(10) NOT NULL AUTO_INCREMENT,
    tenant_id                BIGINT(10) NOT NULL,
    phone_number             VARCHAR(255)       DEFAULT null,
    role                     VARCHAR(255) NOT NULL DEFAULT 'Student', -- Handle at source code level (Student, Adult, Expert, SystemAdmin)
    first_name               VARCHAR(255)       DEFAULT null,
    last_name                VARCHAR(255)       DEFAULT null,
    email_address            VARCHAR(255)       DEFAULT null,
    skills                   TEXT               DEFAULT "",
    field                    TEXT               DEFAULT "",
    internship_experience    BIT(1)             DEFAULT 0,
    soc_cap_index            INT                DEFAULT 0,
    assistant_id             VARCHAR(255)       DEFAULT null,
    thread_id                VARCHAR(255)       DEFAULT null,
    status                   ENUM('Active','Deleted') NOT NULL DEFAULT 'Active',
    motivation               INT                DEFAULT 0,
    stress                   INT                DEFAULT 0,
    help_seeking             BIT(1)             DEFAULT 0,
    resource_awareness       BIT(1)             DEFAULT 0,
    education_attainment     BIT(1)             DEFAULT 0,
    relevant_work_experience BIT(1)             DEFAULT 0,
    life_sustaining_career   BIT(1)             DEFAULT 0,
    life_sustaining_wage     BIT(1)             DEFAULT 0,
    timezone                 VARCHAR(255)       DEFAULT 'America/Los_Angeles',
    created_at               TIMESTAMP NOT NULL DEFAULT current_timestamp(),
    updated_at               TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (id),
    FOREIGN KEY (tenant_id)  REFERENCES tenants(id)
);

CREATE TABLE copilot.relationships (
    id                       BIGINT(10) NOT NULL AUTO_INCREMENT,
    from_account_id          BIGINT(10) NOT NULL,
    to_account_id            BIGINT(10) NOT NULL,
    type                     ENUM('Peer','Advisor','Parent') NOT NULL DEFAULT 'Advisor',
    interaction_count        INT DEFAULT 0,
    last_interaction_date    TIMESTAMP DEFAULT NULL,
    led_to_opportunity       BIT(1) DEFAULT 0,
    created_at               TIMESTAMP NOT NULL DEFAULT current_timestamp(),
    updated_at               TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (id),
    FOREIGN KEY (from_account_id) REFERENCES accounts(id),
    FOREIGN KEY (to_account_id) REFERENCES accounts(id)
);

CREATE TABLE copilot.messages (
    id                       BIGINT(10) NOT NULL AUTO_INCREMENT,
    account_id               BIGINT(10) NOT NULL,
    role                     VARCHAR(255) DEFAULT NULL,
    text                     TEXT DEFAULT NULL,
    flagged                  BIT(1) DEFAULT 0,
    flagged_reason           VARCHAR(255) DEFAULT NULL,
    created_at               TIMESTAMP NOT NULL DEFAULT current_timestamp(),
    updated_at               TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE copilot.opportunities (
    id                        BIGINT(10) NOT NULL AUTO_INCREMENT,
    source_account_id         BIGINT(10) NOT NULL,
    recipient_account_id      BIGINT(10) NOT NULL,
    relationship_id           BIGINT(10) DEFAULT NULL,
    opportunity_type          ENUM('Internship','Job','Mentorship','Project') NOT NULL,
    title                     VARCHAR(255) DEFAULT NULL,
    description               TEXT DEFAULT NULL,
    status                    ENUM('Open','Applied','Interview','Accepted','Rejected','Expired') NOT NULL DEFAULT 'Open',
    source_type               ENUM('NetworkConnection','JobBoard','DirectApplication','Other') NOT NULL,
    compensation_type         ENUM('Paid','Unpaid','Unknown') DEFAULT 'Unknown',
    application_date          TIMESTAMP DEFAULT NULL,
    outcome_date              TIMESTAMP DEFAULT NULL,
    notes                     TEXT DEFAULT NULL,
    created_at                TIMESTAMP NOT NULL DEFAULT current_timestamp(),
    updated_at                TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (id),
    FOREIGN KEY (source_account_id) REFERENCES accounts(id),
    FOREIGN KEY (recipient_account_id) REFERENCES accounts(id),
    FOREIGN KEY (relationship_id) REFERENCES relationships(id)
);