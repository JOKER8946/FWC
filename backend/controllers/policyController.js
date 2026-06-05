const fs = require('fs');
const PolicyDocument = require('../models/PolicyDocument');
const RagChunk = require('../models/RagChunk');
const chunkText = require('../utils/chunkText');
const extractPdfText = require('../utils/extractPdfText');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Upload policy PDF, extract text, chunk into RagChunk collection
// @route   POST /api/policy/upload
// @access  Admin only
// ─────────────────────────────────────────────────────────────────────────────
const uploadPolicy = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No PDF uploaded.' });

  const { title, version, description } = req.body;
  if (!title) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'title is required.' });
  }

  try {
    // ── 1. Deactivate previous versions of same title ─────────────────────────
    await PolicyDocument.updateMany(
      { title: { $regex: new RegExp(`^${title}$`, 'i') } },
      { isActive: false }
    );

    // ── 2. Create document record ─────────────────────────────────────────────
    const doc = await PolicyDocument.create({
      title,
      fileName: req.file.originalname,
      fileUrl: req.file.path,
      uploadedBy: req.user._id,
      version: version || '1.0',
      description: description || null,
      isActive: true,
      chunkingStatus: 'processing',
    });

    // ── 3. Extract text from PDF ──────────────────────────────────────────────
    const buffer = fs.readFileSync(req.file.path);
    const rawText = await extractPdfText(buffer);

    if (!rawText || rawText.trim().length < 50) {
      doc.chunkingStatus = 'failed';
      await doc.save();
      return res.status(422).json({ success: false, message: 'Could not extract text from PDF.' });
    }

    // ── 4. Chunk the text ─────────────────────────────────────────────────────
    const chunks = chunkText(rawText, 700, 120);

    const chunkDocs = chunks.map((content, i) => ({
      documentId: doc._id,
      chunkIndex: i,
      content,
      metadata: { characterCount: content.length },
    }));

    await RagChunk.insertMany(chunkDocs);

    // ── 5. Mark complete ──────────────────────────────────────────────────────
    doc.totalChunks = chunkDocs.length;
    doc.chunkingStatus = 'completed';
    await doc.save();

    res.status(201).json({
      success: true,
      message: `Policy uploaded and chunked into ${chunkDocs.length} segments.`,
      data: {
        _id: doc._id,
        title: doc.title,
        fileName: doc.fileName,
        version: doc.version,
        totalChunks: doc.totalChunks,
        isActive: doc.isActive,
      },
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('uploadPolicy error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    List all policy documents
// @route   GET /api/policy
// @access  All authenticated users
// ─────────────────────────────────────────────────────────────────────────────
const listPolicies = async (req, res) => {
  try {
    const docs = await PolicyDocument.find()
      .populate('uploadedBy', 'email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Toggle a policy document active/inactive
// @route   PATCH /api/policy/:id/toggle
// @access  Admin only
// ─────────────────────────────────────────────────────────────────────────────
const togglePolicy = async (req, res) => {
  try {
    const doc = await PolicyDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
    doc.isActive = !doc.isActive;
    await doc.save();
    res.status(200).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a policy document and its chunks
// @route   DELETE /api/policy/:id
// @access  Admin only
// ─────────────────────────────────────────────────────────────────────────────
const deletePolicy = async (req, res) => {
  try {
    const doc = await PolicyDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    await RagChunk.deleteMany({ documentId: doc._id });
    if (doc.fileUrl && fs.existsSync(doc.fileUrl)) fs.unlinkSync(doc.fileUrl);
    await doc.deleteOne();

    res.status(200).json({ success: true, message: 'Policy and all chunks deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { uploadPolicy, listPolicies, togglePolicy, deletePolicy };
