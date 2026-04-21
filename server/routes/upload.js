import { Router } from "express";
import multer from "multer";
import { uploadPDF } from "../controllers/uploadController.js";

const storage = multer.memoryStorage(); // keep PDF in memory as Buffer

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

const router = Router();
router.post("/", upload.single("pdf"), uploadPDF);

export default router;
