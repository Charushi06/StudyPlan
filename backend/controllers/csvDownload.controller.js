const { db } = require("../../database.js");

/**
 * [GET] /api/download
 * 
 * @param {*} req 
 * @param {*} res 
 * @returns status code 200 and the csv file
 * @returns status code 500 and the error message
 */


// Add an escaping function to combat CSV injection and comma parsing issues
function escapeCSV(str) {
    if (str === null || str === undefined) return '""';
    let stringified = String(str);
    
    // Prevent CSV Formula Injection by escaping =, +, -, @
    if (/^[=+\-@]/.test(stringified)) {
        stringified = "'" + stringified;
    }
    
    // Escape existing double quotes and wrap the whole string in quotes
    return `"${stringified.replace(/"/g, '""')}"`;
}

async function downloadData(req, res) {
    try {
        const query = `
            SELECT tasks.*, subjects.name AS subject_name 
            FROM tasks 
            LEFT JOIN subjects ON tasks.subject_id = subjects.id
            WHERE tasks.user_id = ?
        `;
        const data = await new Promise((resolve, reject) => {
            db.all(query, [req.user.email], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const rows = [
            ["Task ID", "Subject", "Title", "Due At", "Status", "Priority", "Confidence Score", "Notes"],
            ...data.map(task => [
                escapeCSV(task.id),
                escapeCSV(task.subject_name),
                escapeCSV(task.title),
                escapeCSV(task.due_at),
                escapeCSV(task.status),
                escapeCSV(task.priority),
                escapeCSV(task.confidence_score),
                escapeCSV(task.notes)
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