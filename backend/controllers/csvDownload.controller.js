const { db } = require("../../database.js");

/**
 * [GET] /api/download
 *
 * @param {*} req
 * @param {*} res
 * @returns status code 200 and the csv file
 * @returns status code 500 and the error message
 */

// RFC 4180: wrap every field in double-quotes and escape internal quotes as "".
// This prevents commas, newlines, and leading = / + / - / @ from corrupting
// the output or triggering formula execution in spreadsheet applications.
function csvEscape(value) {
    const str = String(value == null ? '' : value);
    return `"${str.replace(/"/g, '""')}"`;
}

async function downloadData(req, res) {
    try {
        const query = `
            SELECT tasks.*, subjects.name AS subject_name
            FROM tasks
            LEFT JOIN subjects ON tasks.subject_id = subjects.id
        `;
        const data = await new Promise((resolve, reject) => {
            db.all(query, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const rows = [
            ["Task ID", "Subject", "Title", "Due At", "Status", "Priority", "Confidence Score", "Notes"].map(csvEscape),
            ...data.map(task => [
                csvEscape(task.id),
                csvEscape(task.subject_name),
                csvEscape(task.title),
                csvEscape(task.due_at),
                csvEscape(task.status),
                csvEscape(task.priority),
                csvEscape(task.confidence_score),
                csvEscape(task.notes || '')
            ])
        ];

        const csvString = rows.map(row => row.join(',')).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="study_data.csv"');
        return res.status(200).send(csvString);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Failed to download data" });
    }
}

module.exports = { downloadData };