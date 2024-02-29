import { Database } from "better-sqlite3";

export enum EmailStatus {
    PENDING,
    PROCESSED,
    FAILED, // TODO: (merge-ok) add failure reason
}

export type Email = {
    id: number;
    headers: Buffer;
    subject: string;
    sender: string;
    status: EmailStatus;
};

type EmailRow = {
    id: number;
    headers: Buffer;
    subject: string;
    sender: string;
    status: number;
};

type InsertEmail = Omit<Email, "id">;

const isEmailRow = (row: unknown): row is EmailRow => {
    if (typeof row !== "object" || row === null) {
        return false;
    }

    return (
        "id" in row &&
        typeof row.id === "number" &&
        "headers" in row &&
        Buffer.isBuffer(row.headers) &&
        "subject" in row &&
        typeof row.subject === "string" &&
        "sender" in row &&
        typeof row.sender === "string" &&
        "status" in row &&
        typeof row.status === "number"
    );
};

const mapEmailRowToEmail = (row: EmailRow): Email => {
    return {
        id: row.id,
        headers: row.headers,
        subject: row.subject,
        sender: row.sender,
        status: row.status as EmailStatus,
    };
};

const mapEmailToEmailRow = (row: Email): EmailRow => {
    return {
        id: row.id,
        headers: row.headers,
        subject: row.subject,
        sender: row.sender,
        status: row.status as number,
    };
};

export default class EmailTable {
    constructor(private database: Database) {
        const createTableStatement = this.database.prepare(`
            CREATE TABLE IF NOT EXISTS emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                headers BLOB,
                subject TEXT,
                sender TEXT,
                status INTEGER
            )
        `);
        createTableStatement.run();
    }

    public selectAll(): Array<Email> {
        const selectAllStatement =
            this.database.prepare(`SELECT * FROM emails`);
        const rowList = selectAllStatement.all();

        return rowList.filter(isEmailRow).map(mapEmailRowToEmail);
    }

    public findEligible(): Array<Email> {
        const selectEligibleStatement = this.database.prepare(`
            SELECT * FROM emails
                WHERE
                    status = 0
                ORDER BY id ASC
        `);
        const rowList = selectEligibleStatement.all();

        return rowList.filter(isEmailRow).map(mapEmailRowToEmail);
    }

    public insert(email: InsertEmail) {
        const insertStatement = this.database.prepare(
            `INSERT INTO emails (headers, subject, sender, status) VALUES ($headers, $subject, $sender, $status)`
        );
        insertStatement.run({
            headers: email.headers,
            subject: email.subject,
            sender: email.sender,
            status: email.status,
        });
    }

    public update(email: Email) {
        const emailRow = mapEmailToEmailRow(email);

        const updateStatement = this.database.prepare(`
            UPDATE emails
            SET
                headers = $headers,
                subject = $subject,
                sender = $sender,
                status = $status
            WHERE 
                id = $id
        `);
        updateStatement.run({
            id: emailRow.id,
            headers: emailRow.headers,
            subject: emailRow.subject,
            sender: emailRow.sender,
            status: emailRow.status,
        });
    }
}
