/* Excelga eksport (SheetJS). Artifact ichida "downloads" imkoniyati orqali, oddiy saytda to'g'ridan-to'g'ri. */
(function () {
  async function saveBlob(filename, blob) {
    try {
      if (window.claude && window.claude.use) {
        const dl = await window.claude.use('downloads');
        if (dl) { await dl.save({ filename, data: blob }); return true; }
      }
    } catch (e) {
      if (e && e.code === 'declined') return false;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }

  /* sheets: [{name, title?, header:[...], rows:[[...]], widths?:[...] }] */
  function exportXlsx(filename, sheets) {
    const wb = XLSX.utils.book_new();
    for (const sh of sheets) {
      const aoa = [];
      if (sh.title) { aoa.push([sh.title]); aoa.push([]); }
      aoa.push(sh.header);
      for (const r of sh.rows) aoa.push(r);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = (sh.widths || sh.header.map((h, i) => {
        let w = String(h).length;
        for (const r of sh.rows.slice(0, 300)) w = Math.max(w, String(r[i] == null ? '' : r[i]).length);
        return Math.min(Math.max(w + 2, 8), 60);
      })).map((w) => ({ wch: w }));
      // raqam formati
      const start = sh.title ? 3 : 1;
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = start; R <= range.e.r; R++) {
        for (let C = 0; C <= range.e.c; C++) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && cell.t === 'n' && !Number.isInteger(cell.v)) cell.z = '#,##0.00';
          else if (cell && cell.t === 'n' && Math.abs(cell.v) >= 1000) cell.z = '#,##0';
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, String(sh.name).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31));
    }
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return saveBlob(filename, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }

  window.Excel = { exportXlsx, saveBlob };
})();
