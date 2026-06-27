const fs = require('fs');
let content = fs.readFileSync('src/components/doctor/ComprehensivePatientHistory.jsx', 'utf8');

// Find the line with 'result.additionalNotes && ('
const searchStr = "{result.additionalNotes && (";
const blockStart = content.indexOf(searchStr);

if (blockStart === -1) {
  console.log('Search string not found');
  process.exit(1);
}

// Find the closing of this block
let braceCount = 0;
let inString = false;
let stringChar = '';
let blockEnd = blockStart;

for (let i = blockStart; i < content.length; i++) {
  const char = content[i];
  
  if (!inString) {
    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
    } else if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        blockEnd = i + 1;
        break;
      }
    }
  } else {
    if (char === stringChar && content[i-1] !== '\\') {
      inString = false;
    }
  }
}

const insertCode = `

                          {(result.results && result.results._images && result.results._images.length > 0) && (
                            <div className="mt-3 pt-3 border-t" style={{ borderColor: '#E5E7EB' }}>
                              <p style={{ color: '#6B7280' }} className="text-sm font-semibold">Attached Images:</p>
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {result.results._images.map((img, idx) => (
                                  <div key={idx} className="relative">
                                    <img src={img.data} alt={"Lab result " + (idx + 1)} className="w-full h-20 object-cover rounded border cursor-pointer" onClick={() => window.open(img.data, '_blank')} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
`;

content = content.slice(0, blockEnd) + insertCode + content.slice(blockEnd);

fs.writeFileSync('src/components/doctor/ComprehensivePatientHistory.jsx', content);
console.log('Done');