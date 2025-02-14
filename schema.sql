-- Drop existing tables in reverse order of dependencies
DROP TABLE IF EXISTS opportunities;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS relationships;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS tenants;

-- Create tables
CREATE TABLE tenants (
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

CREATE TABLE accounts (
    id                       BIGINT(10) NOT NULL AUTO_INCREMENT,
    tenant_id                BIGINT(10) NOT NULL,
    phone_number             VARCHAR(255)       DEFAULT null,
    role                     VARCHAR(255) NOT NULL DEFAULT 'Student', -- Handle at source code level (Student, Adult, Expert, SystemAdmin)
    salutation               VARCHAR(255)       DEFAULT null,
    first_name               VARCHAR(255)       DEFAULT null,
    last_name                VARCHAR(255)       DEFAULT null,
    email_address            VARCHAR(255)       DEFAULT null,
    job_name                 VARCHAR(255)       DEFAULT null,
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

CREATE TABLE relationships (
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

CREATE TABLE messages (
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

CREATE TABLE opportunities (
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

INSERT INTO tenants(name, email, status, logo_url)
VALUES ('Making Waves', 'admin@making_waves.org', 'Active', 'http://making_waves.com/logo');
INSERT INTO tenants(name, email, status, logo_url)
VALUES ('Richmond High School', 'admin@richmond_high.org', 'Active', 'http://richmond_high.com/logo');
INSERT INTO tenants(name, email, status, logo_url)
VALUES ('Palo Alto High School', 'admin@palo_alto_high.org', 'Active', 'http://palo_alto_high.com/logo');


INSERT INTO accounts(tenant_id, phone_number, role, first_name, last_name,
                     motivation, stress, help_seeking, resource_awareness)
VALUES (1, '650-555-1212', 'Student', 'Jeff', 'Risberg', 6, 5, 1, 0);
INSERT INTO accounts(tenant_id, phone_number, role, first_name, last_name,
                     motivation, stress, help_seeking, resource_awareness, relevant_work_experience)
VALUES (1, '650-555-1213', 'Student', 'John', 'Smith', 4, 4, 0, 1, 1);
INSERT INTO accounts(tenant_id, phone_number, role, first_name, last_name,
                     motivation, stress, resource_awareness)
VALUES (1, '650-555-1214', 'Student', 'Sara', 'Student', 9, 4, 1);
INSERT INTO accounts(tenant_id, phone_number, role, first_name, last_name,
                     motivation, stress, help_seeking, education_attainment)
VALUES (1, '650-555-1215', 'Student', 'Larry', 'Learner', 2, 9, 1, 1);
INSERT INTO accounts(tenant_id, phone_number, role, first_name, last_name,
                     motivation, stress, help_seeking, relevant_work_experience)
VALUES (1, '650-555-1216', 'Student', 'Peter', 'Pupil', 2, 3, 1, 1);
INSERT INTO accounts(tenant_id, phone_number, role, first_name, last_name,
                     motivation, stress)
VALUES (1, '650-555-1217', 'Adult', 'Carol', 'Counselor', 0, 0);
INSERT INTO accounts(tenant_id, phone_number, role, first_name, last_name,
                     motivation, stress)
VALUES (1, '650-555-1218', 'Adult', 'Christine', 'Counselor', 0, 0);
INSERT INTO accounts(tenant_id, phone_number, role, first_name, last_name,
                     motivation, stress)
VALUES (1, '650-555-1219', 'Adult', 'Pauline', 'Parent', 0, 0);

INSERT INTO accounts(tenant_id, phone_number, role, salutation, first_name, last_name, job_name, skills, soc_cap_index)
VALUES (1, '650-555-1220', 'Expert', 'Mr.', 'Ed', 'Grossman', 'Environmental Management Consultant',
        'Environmental Science Knowledge, Data Analysis, Critical Thinking, Communication Skills, Fieldwork Skills', 2);
INSERT INTO accounts(tenant_id, phone_number, role, salutation, first_name, last_name, job_name, skills, soc_cap_index)
VALUES (1, '650-555-1221', 'Expert', 'Ms.', 'Fran', 'Moore', 'Stockbroker',
        'Data Analysis, Economics, Statistics, Machine Learning, Problem-Solving', 4);
INSERT INTO accounts(tenant_id, phone_number, role, salutation, first_name, last_name, job_name, skills, soc_cap_index)
VALUES (1, '650-555-1222', 'Expert', 'Mr.', 'Mukesh', 'Nayack', 'Software Engineer',
        'Data Analysis, Programming, Attention to Detail, Mathematics, Logic', 4);
INSERT INTO accounts(tenant_id, phone_number, role, salutation, first_name, last_name, job_name, skills, soc_cap_index)
VALUES (1, '650-555-1223', 'Expert', 'Dr.', 'Steven', 'Hoffman', 'Medical Doctor',
        'Biology and Anatomy Knowledge, Critical Thinking, Empathy, Communication Skills, Time Management', 4);
INSERT INTO accounts(tenant_id, phone_number, role, salutation, first_name, last_name, job_name, skills, soc_cap_index)
VALUES (1, '650-555-1224', 'Expert', 'Dr.', 'Scott', 'Hansen', 'Medical Doctor',
        'Biology and Dental Knowledge, Critical Thinking, Empathy, Communication Skills, Time Management', 4);
INSERT INTO accounts(tenant_id, phone_number, role, salutation, first_name, last_name, job_name, skills, soc_cap_index)
VALUES (1, '650-555-1225', 'Expert', 'Dr.', 'Joy', 'Thompson', 'Psychologist Doctor',
        'Psychology Knowledge, Empathy, Communication Skills, Time Management', 4);
INSERT INTO accounts(tenant_id, phone_number, role, salutation, first_name, last_name, job_name, skills, soc_cap_index)
VALUES (1, '650-555-1226', 'Expert', 'Mr.', 'Larry', 'Corwin', 'Lawyer',
        'Legal, Debate, Teamwork, Persuasion, Presentation, Meticulous', 5);
INSERT INTO accounts(tenant_id, phone_number, role, salutation, first_name, last_name, job_name, skills, soc_cap_index)
VALUES (1, '650-555-1227', 'Expert', 'Ms.', 'Pat', 'Stone', 'Public Relations Officer',
        'Communication Skills, Media Relations, Writing and Editing, Social Media Proficiency, Strategic Thinking', 7);
INSERT INTO accounts(tenant_id, phone_number, role, salutation, first_name, last_name, job_name, skills, soc_cap_index)
VALUES (1, '650-555-1228', 'Expert', 'Ms.', 'Debbie', 'Sterling', 'Teacher',
        'Subject Knowledge, Patience, Public Speaking, Classroom Management, Adaptability', 4);
INSERT INTO accounts(tenant_id, phone_number, role, salutation, first_name, last_name, job_name, skills, soc_cap_index)
VALUES (1, '650-555-1229', 'Expert', 'Mr.', 'Charlie', 'Rose', 'Cybersecurity Analyst',
        'Network Security, Risk Assessment, Programming (e.g., Python, JavaScript), Attention to Detail, Problem-Solving',
        3);

INSERT INTO accounts(tenant_id, phone_number, first_name, last_name,
                     motivation, stress, help_seeking, relevant_work_experience)
VALUES (2, '650-555-1250', 'Susan', 'Scholar', 3, 4, 1, 1);

INSERT INTO relationships(from_account_id, to_account_id, type)
VALUES (1, 6, 'Advisor');
INSERT INTO relationships(from_account_id, to_account_id, type)
VALUES (2, 6, 'Advisor');
INSERT INTO relationships(from_account_id, to_account_id, type)
VALUES (3, 6, 'Advisor');
INSERT INTO relationships(from_account_id, to_account_id, type)
VALUES (4, 6, 'Advisor');
INSERT INTO relationships(from_account_id, to_account_id, type)
VALUES (5, 7, 'Advisor');
