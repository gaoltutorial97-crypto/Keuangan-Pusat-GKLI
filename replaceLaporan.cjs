const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `  const getLaporanData = (tabId: 'laporan' | 'pelean' | 'alaman' | 'perorangan' | 'distribusi') => {
    const kategori = tabId === 'perorangan' ? 'alaman' : (tabId === 'distribusi' ? 'alaman' : tabId);
    const columns = SPREADSHEET_COLUMNS[kategori] || [];
    let data = [...churches];
    
    // Apply filters matching the global ones
    if (filterResort !== 'Semua Resort') {
      const normFilter = normalizeResortName(filterResort);
      data = data.filter(c => normalizeResortName(c.resort) === normFilter);
    }
    if (filterWilayah !== 'Semua Wilayah') {
      data = data.filter(c => c.wilayah === filterWilayah);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(c => 
        c.nama.toLowerCase().includes(lower) || 
        c.resort.toLowerCase().includes(lower)
      );
    }

    // Filter based on tabId
    if (tabId === 'distribusi' || tabId === 'laporan' || tabId === 'pelean' || tabId === 'alaman') {
      data = data.filter(c => c.type !== 'perorangan');
    } else if (tabId === 'perorangan') {
      data = data.filter(c => c.type === 'perorangan');
    }

    data.sort((a,b) => {
      // GLOBAL PRIORITY: Jemaat vs Pos PI (Pos PI goes to the absolute bottom)
      const isAPosPI = a.nama.toLowerCase().includes('pos pi');
      const isBPosPI = b.nama.toLowerCase().includes('pos pi');
      
      if (isAPosPI && !isBPosPI) return 1;
      if (!isAPosPI && isBPosPI) return -1;
      
      if (filterResort === 'Semua Resort' && sortType === 'order') {
        const wA = getWilayahLevel(a.wilayah);
        const wB = getWilayahLevel(b.wilayah);
        if (wA !== wB) return wA - wB;
        
        const rComp = compareResorts(a.resort || '', b.resort || '');
        if (rComp !== 0) return rComp;
        
        if (a.type !== b.type) return a.type === 'resort' ? -1 : 1;
        return (a.order || 0) - (b.order || 0);
      }

      const wA = getWilayahLevel(a.wilayah);
      const wB = getWilayahLevel(b.wilayah);
      if (wA !== wB) return wA - wB;
      
      const resA = a.resort || '';
      const resB = b.resort || '';
      const rComp = compareResorts(resA, resB);
      if (rComp !== 0) return rComp;
      
      // If one is a 'resort' type entry and other is church, resort goes first
      if (a.type !== b.type) return a.type === 'resort' ? -1 : 1;

      return a.nama.localeCompare(b.nama);
    });

    const mappedData = data
      .map(gereja => {
        const targetIdentityKey = getChurchIdentityKey(gereja);
        
        const dataList = tabId === 'distribusi' ? distributions : payments;
        
        const pembayaranList = dataList.filter(p => {
          if (tabId !== 'distribusi') {
            if ((p.kategori || '').toLowerCase() !== kategori.toLowerCase()) return false;
          }
          if (normalizePeriode(p.periode) !== normalizePeriode(periodeAktif)) return false;

          const pChurch = allChurches.find(c => c.id === p.gerejaId);
          if (pChurch) {
            return getChurchIdentityKey(pChurch) === targetIdentityKey;
          }
          
          const aliases = churchAliasesMap[gereja.id] || [gereja.id];
          return aliases.includes(p.gerejaId);
        });
        
        let combinedDetails: Record<string, number> = {};
        pembayaranList.forEach(p => {
          if (p.details) {
            Object.entries(p.details).forEach(([k, v]) => {
              combinedDetails[k] = (combinedDetails[k] || 0) + (v as number || 0);
            });
          }
        });

        const filledColumnsCount = columns.filter(col => (combinedDetails[col] || 0) > 0).length;
        
        let status = 'Menunggak';
        if (tabId !== 'distribusi') {
          if (filledColumnsCount === columns.length) {
            status = 'Lunas';
          } else if (filledColumnsCount > 0) {
            status = 'Proses';
          }
        } else {
          status = filledColumnsCount > 0 ? 'Terkirim' : '-';
        }

        const combinedJumlah = tabId !== 'distribusi' ? Object.values(combinedDetails).reduce((sum, val) => sum + ((val as number) || 0), 0) as number : 0;
        
        let latestDate = null;
        if (pembayaranList.length > 0) {
          latestDate = pembayaranList.reduce((latest, current) => {
            if (!latest) return current.tanggal;
            if (!current.tanggal) return latest;
            return new Date(current.tanggal) > new Date(latest) ? current.tanggal : latest;
          }, null as string | null);
        }

        return {
          ...gereja,
          status: status,
          jumlah: combinedJumlah,
          tanggal: latestDate,
          details: combinedDetails,
          kategori: kategori,
          periode: periodeAktif
        };
      });

    if (tabId === 'alaman') {
      const peroranganData = getLaporanData('perorangan');
      if (peroranganData.length > 0) {
        let totalJumlah = 0;
        let aggDetails: Record<string, number> = {};
        peroranganData.forEach(p => {
          totalJumlah += p.jumlah;
          Object.entries(p.details).forEach(([k, v]) => {
            aggDetails[k] = (aggDetails[k] || 0) + v;
          });
        });
        mappedData.push({
          id: 'perorangan-agg',
          nama: 'PEMBELIAN PERORANGAN',
          resort: '-',
          wilayah: '-',
          wa: '',
          type: 'agg-perorangan',
          status: '-',
          jumlah: totalJumlah,
          tanggal: null,
          details: aggDetails,
          kategori: kategori,
          periode: periodeAktif
        } as any);
      }
    }

    if (tabId === 'perorangan') {
      return mappedData.filter(m => Object.keys(m.details || {}).length > 0);
    } else if (tabId === 'distribusi') {
      return mappedData.filter(m => Object.keys(m.details || {}).length > 0);
    }
    
    return mappedData;
  };`;

const startIndex = content.indexOf("const getLaporanData = (tabId: 'laporan' | 'pelean' | 'alaman' | 'perorangan') => {");
const endIndex = content.indexOf("  };", startIndex) + 4; // match end of getLaporanData
if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync('src/App.tsx', content);
  console.log('Successfully replaced getLaporanData');
} else {
  console.log('Failed to find getLaporanData boundaries', startIndex, endIndex);
}
