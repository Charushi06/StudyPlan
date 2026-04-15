const express = require("express");
const { downloadData } = require("../controllers/dataExport.controller.js");

const router = express.Router();

router.get("/download", downloadData);

module.exports = router;