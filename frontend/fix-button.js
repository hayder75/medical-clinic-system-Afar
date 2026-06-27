const fs = require('fs');
const file = 'src/pages/lab/LabOrders.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldButton = `<button
                  onClick={handleCompleteBatchOrder}
                  className=px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors
                >
                  Complete All Tests
                </button>`;

const newButton = `<button
                  onClick={handleCompleteBatchOrder}
                  disabled={savingResults}
                  className=px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed flex items-center gap-2
                >
                  {savingResults ? (
                    <>
                      <svg className=animate-spin h-4 w-4 viewBox=0 0 24 24>
                        <circle className=opacity-25 cx=12 cy=12 r=10 stroke=currentColor strokeWidth=4 fill=none />
                        <path className=opacity-75 fill=currentColor d=M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z />
                      </svg>
                      Saving...
                    </>
                  ) : 'Complete All Tests'}
                </button>`;

content = content.replace(oldButton, newButton);
fs.writeFileSync(file, content);
console.log('Done');
