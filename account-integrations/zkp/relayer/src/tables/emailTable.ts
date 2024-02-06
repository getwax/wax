import { Database } from "better-sqlite3";

export enum EmailStatus {
    PENDING,
    PROCESSED,
}

export type Email = {
    id: number;
    status: EmailStatus;
    subject: string;
    sender: string;
};

type EmailRow = {
    id: number;
    status: number;
    subject: string;
    sender: string;
};

type InsertEmail = Omit<Email, "id">;

const isEmailRow = (row: unknown): row is EmailRow => {
    if (typeof row !== "object" || row === null) {
        return false;
    }

    return (
        "id" in row &&
        typeof row.id === "number" &&
        "status" in row &&
        typeof row.status === "number" &&
        "subject" in row &&
        typeof row.subject === "string" &&
        "sender" in row &&
        typeof row.sender === "string"
    );
};

const mapEmailRowToEmail = (row: EmailRow): Email => {
    return {
        id: row.id,
        status: row.status as EmailStatus,
        subject: row.subject,
        sender: row.sender,
    };
};

const mapEmailToEmailRow = (row: Email): EmailRow => {
    return {
        id: row.id,
        status: row.status as number,
        subject: row.subject,
        sender: row.sender,
    };
};

export default class EmailTable {
    constructor(public database: Database) {
        const createTableStatement = this.database.prepare(`
            CREATE TABLE IF NOT EXISTS emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status INTEGER,
                subject TEXT,
                sender TEXT
            )
        `);
        createTableStatement.run();
    }

    selectAll(): Array<Email> {
        const selectAllStatement =
            this.database.prepare(`SELECT * FROM emails`);
        const rowList = selectAllStatement.all();

        return rowList.filter(isEmailRow).map(mapEmailRowToEmail);
    }

    findEligible(): Array<Email> {
        const selectEligibleStatement = this.database.prepare(`
            SELECT * FROM emails
                WHERE
                    status = 0
                ORDER BY id ASC
        `);
        const rowList = selectEligibleStatement.all();

        return rowList.filter(isEmailRow).map(mapEmailRowToEmail);
    }

    insert(email: InsertEmail) {
        const insertStatement = this.database.prepare(
            `INSERT INTO emails (status, subject, sender) VALUES ($status, $subject, $sender)`
        );
        insertStatement.run({
            status: email.status,
            subject: email.subject,
            sender: email.sender,
        });
    }

    update(email: Email) {
        const emailRow = mapEmailToEmailRow(email);

        const updateStatement = this.database.prepare(`
            UPDATE emails
            SET
                status = $status,
                subject = $subject,
                sender = $sender
            WHERE 
                id = $id
        `);
        updateStatement.run({
            id: emailRow.id,
            status: emailRow.status,
            subject: emailRow.subject,
            sender: emailRow.sender,
        });
    }
}
