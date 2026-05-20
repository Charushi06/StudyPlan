const { db } = require("../../database.js");

/**
 * [GET] /api/download
 * 
 * @param {*} req 
 * @param {*} res 
 * @returns status code 200 and the csv file
 * @returns status code 500 and the error message
 */


function escapeCSVField(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // If the field contains quotes, commas, or newlines, escape quotes and wrap in quotes
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
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

        const headers = ["Task ID", "Subject", "Title", "Due At", "Status", "Priority", "Confidence Score", "Notes"];
        const rows = data.map(task => [
            task.id,
            task.subject_name,
            task.title,
            task.due_at,
            task.status,
            task.priority,
            task.confidence_score,
            task.notes
        ]);

        const csvString = [headers, ...rows]
            .map(row => row.map(escapeCSVField).join(','))
            .join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="study_data.csv"');
        return res.status(200).send(csvString);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Failed to download data" });
    }
}

module.exports = { downloadData };