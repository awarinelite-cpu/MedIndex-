import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Upload, FileText, CheckCircle, XCircle, Download } from 'lucide-react';

const REQUIRED_FIELDS = ['generic_name', 'drug_class', 'prescription_status', 'primary_indications'];
const VALID_STATUSES = ['OTC', 'Prescription', 'Controlled'];

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, validating, uploading, success, error
  const [previewMode, setPreviewMode] = useState(true);

  const onDrop = useCallback((acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setUploadStatus('validating');

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data;
        setParsedData(data);
        validateData(data);
      },
      error: (err) => {
        setValidationErrors([{ row: 0, message: 'CSV parsing error: ' + err.message }]);
        setUploadStatus('error');
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    multiple: false
  });

  function validateData(data) {
    const errors = [];

    data.forEach((row, index) => {
      const rowNum = index + 2; // +2 for header row and 1-based indexing

      // Check required fields
      REQUIRED_FIELDS.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errors.push({ row: rowNum, field, message: `Missing required field: ${field}` });
        }
      });

      // Validate prescription_status
      if (row.prescription_status && !VALID_STATUSES.includes(row.prescription_status)) {
        errors.push({ row: rowNum, field: 'prescription_status', message: `Invalid status: "${row.prescription_status}". Must be OTC, Prescription, or Controlled.` });
      }

      // Validate controlled substance schedule
      if (row.prescription_status === 'Controlled' && (!row.controlled_substance_schedule || row.controlled_substance_schedule === 'N/A')) {
        errors.push({ row: rowNum, field: 'controlled_substance_schedule', message: 'Controlled substances require a schedule (CI, CII, CIII, CIV, CV)' });
      }

      // Validate black box warning
      if (row.black_box_warning === 'TRUE' && (!row.black_box_warning_text || row.black_box_warning_text.trim() === '')) {
        errors.push({ row: rowNum, field: 'black_box_warning_text', message: 'Black box warning text required when black_box_warning is TRUE' });
      }

      // Validate boolean fields
      ['orphan_drug', 'generic_availability', 'biosimilar'].forEach(field => {
        if (row[field] && !['TRUE', 'FALSE', ''].includes(row[field])) {
          errors.push({ row: rowNum, field, message: `${field} must be TRUE, FALSE, or blank` });
        }
      });
    });

    setValidationErrors(errors);
    setUploadStatus(errors.length === 0 ? 'ready' : 'error');
  }

  async function handleUpload() {
    if (validationErrors.length > 0) return;

    setUploadStatus('uploading');
    setUploadProgress({ current: 0, total: parsedData.length });

    let errorCount = 0;

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      try {
        // Clean up empty strings to null/undefined
        const cleanRow = {};
        Object.keys(row).forEach(key => {
          const val = row[key];
          cleanRow[key] = val && val.trim() !== '' ? val.trim() : null;
        });

        // Add metadata
        cleanRow.created_at = serverTimestamp();
        cleanRow.last_updated = serverTimestamp();
        cleanRow.status = 'Active';
        cleanRow.source = 'CSV Upload';

        await addDoc(collection(db, 'drugs'), cleanRow);
      } catch (err) {
        console.error(`Error uploading row ${i + 2}:`, err);
        errorCount++;
      }

      setUploadProgress({ current: i + 1, total: parsedData.length });
    }

    setUploadStatus(errorCount === 0 ? 'success' : 'partial');
  }

  function downloadTemplate() {
    const templateHeaders = Object.keys(parsedData[0] || {});
    if (templateHeaders.length === 0) {
      // Default template if no file uploaded yet
      const defaultHeaders = ['generic_name','drug_class','prescription_status','primary_indications','brand_names','dosage_forms','strengths','route_of_administration','mechanism_of_action','description','adult_dosing_initial','side_effects_common','contraindications','pregnancy_category','status'];
      const csv = Papa.unparse([defaultHeaders.reduce((acc, h) => ({...acc, [h]: ''}), {})]);
      downloadCSV(csv, 'drug_bank_template.csv');
      return;
    }
    const csv = Papa.unparse([templateHeaders.reduce((acc, h) => ({...acc, [h]: ''}), {})]);
    downloadCSV(csv, 'drug_bank_template.csv');
  }

  function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  const errorByRow = validationErrors.reduce((acc, err) => {
    if (!acc[err.row]) acc[err.row] = [];
    acc[err.row].push(err);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary-100 rounded-xl">
          <Upload className="w-6 h-6 text-primary-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Bulk Upload</h1>
          <p className="text-drug-muted text-sm">Upload medications via CSV file</p>
        </div>
      </div>

      {/* Upload Area */}
      {!file && (
        <>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              isDragActive 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-drug-border hover:border-primary-300 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-drug-muted mx-auto mb-4" />
            <p className="text-lg font-semibold text-drug-text">
              {isDragActive ? 'Drop your CSV file here' : 'Drag & drop your CSV file here'}
            </p>
            <p className="text-sm text-drug-muted mt-2">or click to browse</p>
            <p className="text-xs text-drug-muted mt-4">Supported: .csv, .xlsx (save as CSV first)</p>
          </div>

          <div className="mt-6 flex justify-center">
            <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> Download Blank Template
            </button>
          </div>
        </>
      )}

      {/* File Info & Validation */}
      {file && (
        <div className="space-y-6">
          {/* File Summary */}
          <div className="bg-white border border-drug-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary-600" />
              <div>
                <p className="font-semibold">{file.name}</p>
                <p className="text-sm text-drug-muted">{(file.size / 1024).toFixed(1)} KB • {parsedData.length} rows</p>
              </div>
            </div>
            <button onClick={() => { setFile(null); setParsedData([]); setValidationErrors([]); setUploadStatus('idle'); }} className="btn-secondary">
              Remove File
            </button>
          </div>

          {/* Validation Status */}
          {uploadStatus === 'validating' && (
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full" />
              <p className="text-primary-800 font-medium">Validating {parsedData.length} rows...</p>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-red-800">{validationErrors.length} Validation Errors Found</h3>
              </div>
              <p className="text-sm text-red-700 mb-3">Fix these errors in your CSV and re-upload.</p>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(errorByRow).map(([rowNum, errors]) => (
                  <div key={rowNum} className="bg-white rounded-lg p-3 border border-red-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">Row {rowNum}</span>
                    </div>
                    <ul className="text-sm text-red-700 space-y-1">
                      {errors.map((err, i) => (
                        <li key={i}>• <code className="font-mono bg-red-50 px-1 rounded">{err.field}</code>: {err.message}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadStatus === 'ready' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-bold text-green-800">Validation Passed</p>
                <p className="text-sm text-green-700">{parsedData.length} rows ready to upload. No errors found.</p>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploadStatus === 'uploading' && (
            <div className="bg-white border border-drug-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">Uploading...</span>
                <span className="text-sm text-drug-muted">{uploadProgress.current} / {uploadProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {uploadStatus === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-800">Upload Complete!</h3>
              <p className="text-green-700 mt-2">{parsedData.length} drugs successfully added to the database.</p>
              <button onClick={() => { setFile(null); setParsedData([]); setUploadStatus('idle'); }} className="btn-primary mt-4">
                Upload Another File
              </button>
            </div>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && uploadStatus !== 'success' && (
            <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-drug-border">
                <h3 className="font-bold">Data Preview</h3>
                <button onClick={() => setPreviewMode(!previewMode)} className="text-sm text-primary-600 font-medium">
                  {previewMode ? 'Show All Columns' : 'Show Key Columns'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-drug-border">
                      <th className="text-left px-4 py-2 font-semibold text-drug-muted w-10">#</th>
                      <th className="text-left px-4 py-2 font-semibold text-drug-muted">Generic Name</th>
                      <th className="text-left px-4 py-2 font-semibold text-drug-muted">Class</th>
                      <th className="text-left px-4 py-2 font-semibold text-drug-muted">Status</th>
                      <th className="text-left px-4 py-2 font-semibold text-drug-muted">Indications</th>
                      {!previewMode && Object.keys(parsedData[0] || {}).filter(k => !['generic_name','drug_class','prescription_status','primary_indications'].includes(k)).map(key => (
                        <th key={key} className="text-left px-4 py-2 font-semibold text-drug-muted text-xs">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((row, i) => (
                      <tr key={i} className={`border-b border-drug-border hover:bg-gray-50 ${errorByRow[i + 2] ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2 text-drug-muted">{i + 1}</td>
                        <td className="px-4 py-2 font-medium">{row.generic_name}</td>
                        <td className="px-4 py-2 text-drug-muted">{row.drug_class}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            row.prescription_status === 'OTC' ? 'bg-green-100 text-green-700' :
                            row.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {row.prescription_status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-drug-muted max-w-xs truncate">{row.primary_indications}</td>
                        {!previewMode && Object.keys(row).filter(k => !['generic_name','drug_class','prescription_status','primary_indications'].includes(k)).map(key => (
                          <td key={key} className="px-4 py-2 text-drug-muted text-xs max-w-xs truncate">{row[key]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && (
                  <div className="text-center py-3 text-sm text-drug-muted border-t border-drug-border">
                    ...and {parsedData.length - 10} more rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {uploadStatus !== 'uploading' && uploadStatus !== 'success' && (
            <div className="flex gap-3">
              <button 
                onClick={handleUpload} 
                disabled={validationErrors.length > 0}
                className={`btn-primary flex-1 flex items-center justify-center gap-2 ${validationErrors.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="w-4 h-4" />
                {validationErrors.length > 0 ? 'Fix Errors to Upload' : `Upload ${parsedData.length} Drugs`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
