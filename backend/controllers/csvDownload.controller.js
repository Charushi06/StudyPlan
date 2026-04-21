const { db } = require("../../database.js");

/**
 * [GET] /api/download
 * 
 * @param {*} req 
 * @param {*} res 
 * @returns status code 200 and the csv file
 * @returns status code 500 and the error message
 */


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
            ["Task ID", "Subject", "Title", "Due At", "Status", "Priority", "Confidence Score", "Notes"],
            ...data.map(task => [
                task.id,
                task.subject_name,
                task.title,
                task.due_at,
                task.status,
                task.priority,
                task.confidence_score,
                `"${(task.notes || '').replace(/"/g, '""')}"`
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