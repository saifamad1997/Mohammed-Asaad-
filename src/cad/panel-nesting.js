/**
 * Deterministic rectangular panel nesting (shelf / guillotine-style estimate).
 * All dimensions are millimetres. This is a planning aid, not certified CAM output.
 */
export function nestPanels(parts, stock, options = {}) {
  const kerf = nonNegative(options.kerfMm ?? 3, 'kerfMm');
  const margin = nonNegative(options.marginMm ?? 10, 'marginMm');
  const minOffcut = nonNegative(options.minOffcutMm ?? 100, 'minOffcutMm');
  const sheetWidth = positive(stock?.widthMm, 'stock.widthMm');
  const sheetHeight = positive(stock?.heightMm, 'stock.heightMm');
  const thickness = positive(stock?.thicknessMm, 'stock.thicknessMm');
  const usableWidth = sheetWidth - margin * 2;
  const usableHeight = sheetHeight - margin * 2;
  if (usableWidth <= 0 || usableHeight <= 0) throw new RangeError('هوامش اللوح أكبر من أبعاده.');

  const expanded = [];
  for (const [index, part] of (parts || []).entries()) {
    const widthMm = positive(part.widthMm, `parts[${index}].widthMm`);
    const heightMm = positive(part.lengthMm, `parts[${index}].lengthMm`);
    const qty = positiveInteger(part.qty ?? 1, `parts[${index}].qty`);
    const partThickness = positive(part.thicknessMm ?? thickness, `parts[${index}].thicknessMm`);
    if (Math.abs(partThickness - thickness) > 0.001) throw new RangeError(`سماكة القطعة "${part.label || index + 1}" لا تطابق سماكة اللوح.`);
    for (let n = 0; n < qty; n++) expanded.push({
      id: String(part.id ?? `part-${index + 1}`), label: String(part.label ?? `قطعة ${index + 1}`),
      widthMm, heightMm, canRotate: part.grainDirection === 'none' || part.allowRotate === true,
      grainDirection: part.grainDirection || 'length'
    });
  }
  expanded.sort((a,b) => Math.max(b.widthMm,b.heightMm)-Math.max(a.widthMm,a.heightMm) ||
    b.widthMm*b.heightMm-a.widthMm*a.heightMm || a.label.localeCompare(b.label, 'ar'));

  const sheets = [];
  const unplaced = [];
  for (const part of expanded) {
    const w0 = part.widthMm + kerf, h0 = part.heightMm + kerf;
    const orientations = [{w:w0,h:h0,rotated:false}];
    if (part.canRotate && Math.abs(part.widthMm-part.heightMm)>0.001) orientations.push({w:h0,h:w0,rotated:true});
    if (!orientations.some(o => o.w <= usableWidth && o.h <= usableHeight)) {
      unplaced.push({...part, reason:'أبعاد القطعة أكبر من مساحة اللوح الصالحة'});
      continue;
    }
    let best = null;
    for (let si=0;si<sheets.length;si++) {
      const sheet=sheets[si];
      for (let ri=0;ri<sheet.rows.length;ri++) {
        const row=sheet.rows[ri];
        for (const o of orientations) {
          if (o.h <= row.height && o.w <= usableWidth-row.usedWidth) {
            const score=(row.height-o.h)*usableWidth + (usableWidth-row.usedWidth-o.w);
            if (!best || score<best.score) best={si,ri,o,score,newRow:false};
          }
        }
      }
      for (const o of orientations) {
        if (o.h <= usableHeight-sheet.usedHeight && o.w <= usableWidth) {
          const score=(usableHeight-sheet.usedHeight-o.h)*usableWidth + (usableWidth-o.w);
          if (!best || score<best.score) best={si,ri:sheet.rows.length,o,score,newRow:true};
        }
      }
    }
    if (!best) {
      const sheet={number:sheets.length+1,rows:[],usedHeight:0,placements:[]};
      sheets.push(sheet);
      for (const o of orientations) {
        if (o.w<=usableWidth && o.h<=usableHeight) {
          const score=(usableHeight-o.h)*usableWidth+(usableWidth-o.w);
          if (!best || score<best.score) best={si:sheets.length-1,ri:0,o,score,newRow:true};
        }
      }
    }
    const sheet=sheets[best.si];
    let row=sheet.rows[best.ri];
    if (best.newRow) {
      row={y:sheet.usedHeight,height:best.o.h,usedWidth:0};
      sheet.rows.push(row); sheet.usedHeight+=best.o.h;
    }
    const x=row.usedWidth, y=row.y;
    row.usedWidth+=best.o.w;
    sheet.placements.push({
      id:part.id,label:part.label,xMm:margin+x,yMm:margin+y,
      widthMm:best.o.rotated?part.lengthMm:part.widthMm,
      lengthMm:best.o.rotated?part.widthMm:part.lengthMm,
      rotated:best.o.rotated
    });
  }

  const results=sheets.map(sheet=>{
    const offcuts=[];
    for (const row of sheet.rows) {
      const w=usableWidth-row.usedWidth, h=row.height-kerf;
      if (w>=minOffcut && h>=minOffcut) offcuts.push({xMm:margin+row.usedWidth,yMm:margin+row.y,widthMm:w,lengthMm:h,source:'row'});
    }
    const bottom=usableHeight-sheet.usedHeight;
    if (bottom>=minOffcut && usableWidth>=minOffcut) offcuts.push({xMm:margin,yMm:margin+sheet.usedHeight,widthMm:usableWidth,lengthMm:bottom,source:'bottom'});
    const area=sheet.placements.reduce((sum,p)=>sum+p.widthMm*p.lengthMm,0);
    return {number:sheet.number,placements:sheet.placements,offcuts,usedAreaMm2:area,
      utilizationPercent:Number((area/(sheetWidth*sheetHeight)*100).toFixed(1))};
  });
  return {
    algorithm:'shelf-first-fit-decreasing',
    quality:'تخطيط تقديري أولي؛ ليس تحسيناً أمثل ولا ملف CNC',
    stock:{widthMm:sheetWidth,heightMm:sheetHeight,thicknessMm:thickness},
    settings:{kerfMm:kerf,marginMm:margin,minOffcutMm:minOffcut},
    sheetCount:results.length,sheets:results,unplaced,
    totalParts:expanded.length,placedParts:expanded.length-unplaced.length,
    totalOffcutAreaMm2:results.reduce((s,p)=>s+p.offcuts.reduce((a,o)=>a+o.widthMm*o.lengthMm,0),0)
  };
}
function positive(value,name){const n=Number(value);if(!Number.isFinite(n)||n<=0)throw new RangeError(name+' يجب أن يكون رقماً أكبر من صفر.');return n;}\nfunction positiveInteger(value,name){const n=positive(value,name);if(!Number.isInteger(n))throw new RangeError(name+' يجب أن يكون عدداً صحيحاً.');return n;}
function nonNegative(value,name){const n=Number(value);if(!Number.isFinite(n)||n<0)throw new RangeError(name+' يجب ألا يكون سالباً.');return n;}
