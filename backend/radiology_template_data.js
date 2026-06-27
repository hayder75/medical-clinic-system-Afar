module.exports = {
  'X-Ray Chest': {
    clinicalIndication: 'Cough, fever, dyspnea, chest pain, rule out pneumonia, tuberculosis, or pleural effusion',
    technique: 'Standard posterior-anterior (PA) and lateral chest radiographs. Adequate inspiration with full lung fields visualized.',
    findings: 'Normal chest radiograph. Clear lung fields bilaterally. Normal cardiac silhouette. No pleural effusion or pneumothorax.',
    conclusion: 'Normal chest X-ray.'
  },
  'X-Ray Abdomen': {
    clinicalIndication: 'Abdominal pain, distension, nausea, vomiting, rule out obstruction or perforation',
    technique: 'Supine and erect abdominal radiographs. Includes diaphragms to pelvis.',
    findings: 'Normal abdominal radiograph. Normal bowel gas pattern. No free air under diaphragm. No abnormal calcifications.',
    conclusion: 'Normal abdominal X-ray.'
  },
  'X-Ray Extremity': {
    clinicalIndication: 'Trauma, fall, localized pain, swelling, rule out fracture or dislocation',
    technique: 'Standard anteroposterior (AP) and lateral views of the affected extremity. Additional oblique views as needed.',
    findings: 'Normal bone alignment. No fracture or dislocation. Joint spaces are preserved. No soft tissue abnormality.',
    conclusion: 'Normal extremity X-ray.'
  },
  'Ultrasound Abdomen': {
    clinicalIndication: 'Right upper quadrant pain, jaundice, abdominal mass, rule out gallstones or liver disease',
    technique: 'Gray-scale and color Doppler ultrasound of the abdomen using a phased array and convex transducer. Patient fasting.',
    findings: 'Liver: normal size and echotexture. No focal lesion. Gallbladder: normal wall thickness, no stones. Pancreas: normal. Spleen: normal. Kidneys: normal size and echogenicity. No hydronephrosis.',
    conclusion: 'Normal abdominal ultrasound.'
  },
  'Ultrasound Pelvis': {
    clinicalIndication: 'Pelvic pain, abnormal bleeding, palpable mass, routine gynecologic evaluation',
    technique: 'Transabdominal and transvaginal pelvic ultrasound. Bladder adequately distended for transabdominal views.',
    findings: 'Uterus: normal size and contour. Endometrium: normal thickness. Ovaries: normal size and appearance. No adnexal mass. No free fluid.',
    conclusion: 'Normal pelvic ultrasound.'
  },
  'Ultrasound Obstetric': {
    clinicalIndication: 'Routine prenatal screening, dating, viability, multiple gestation, bleeding in pregnancy',
    technique: 'Standard obstetric ultrasound protocol. Transabdominal approach with convex transducer. Fetal biometry and anatomy survey.',
    findings: 'Single viable intrauterine pregnancy. Fetal heart rate: normal. Placenta: normal position. Amniotic fluid: normal volume.',
    conclusion: 'Normal obstetric ultrasound.'
  },
  'Ultrasound Thyroid': {
    clinicalIndication: 'Thyroid nodule, goiter, neck swelling, hyperthyroidism or hypothyroidism evaluation',
    technique: 'High-resolution gray-scale and color Doppler ultrasound of the thyroid gland. Linear array transducer. Transverse and longitudinal views.',
    findings: 'Thyroid gland: normal size and echotexture. No nodule or cyst. No abnormal vascularity.',
    conclusion: 'Normal thyroid ultrasound.'
  },
  'Ultrasound Breast': {
    clinicalIndication: 'Breast lump, mastalgia, nipple discharge, screening, follow-up of prior finding',
    technique: 'Whole breast ultrasound using a high-frequency linear array transducer. Radial and anti-radial scanning planes.',
    findings: 'Breast parenchyma: normal. No mass, cyst, or abnormal calcification. No axillary lymphadenopathy.',
    conclusion: 'Normal breast ultrasound.'
  },
  'Ultrasound Doppler': {
    clinicalIndication: 'Peripheral vascular disease, DVT evaluation, arterial insufficiency, varicose veins',
    technique: 'Color and spectral Doppler ultrasound of the examined vessels. Grayscale imaging with compression technique.',
    findings: 'Normal flow patterns in examined vessels. No stenosis, occlusion, or thrombus. Normal waveforms bilaterally.',
    conclusion: 'Normal Doppler study.'
  },
  'CT Scan Head': {
    clinicalIndication: 'Headache, trauma, stroke symptoms, seizure, altered mental status, rule out hemorrhage or mass',
    technique: 'Non-contrast axial CT scan of the head. Multiplanar reconstructions (coronal and sagittal). 5mm slice thickness.',
    findings: 'Normal brain parenchyma. No hemorrhage, mass effect, or midline shift. Ventricles normal. No acute infarct.',
    conclusion: 'Normal CT head.'
  },
  'CT Scan Abdomen': {
    clinicalIndication: 'Abdominal pain, weight loss, suspected mass, trauma, follow-up of known pathology',
    technique: 'Contrast-enhanced CT of the abdomen and pelvis. Portal venous phase. Oral contrast administered. Multiplanar reconstructions.',
    findings: 'Normal abdominal CT. Liver, spleen, pancreas, kidneys: normal. Bowel: normal. No lymphadenopathy.',
    conclusion: 'Normal abdominal CT.'
  },
  'MRI Brain': {
    clinicalIndication: 'Chronic headache, seizure, neurologic deficit, demyelinating disease workup, tumor evaluation',
    technique: 'Brain MRI with and without contrast. Sequences: T1, T2, FLAIR, DWI, SWI, and post-contrast T1. 3mm slice thickness.',
    findings: 'Normal brain MRI. No mass, infarct, or demyelinating lesion. Normal ventricular system.',
    conclusion: 'Normal brain MRI.'
  },
  'Mammography': {
    clinicalIndication: 'Breast cancer screening, palpable mass, nipple discharge, family history of breast cancer',
    technique: 'Standard digital mammography. Craniocaudal (CC) and mediolateral oblique (MLO) views of both breasts.',
    findings: 'Breast tissue: normal. No mass, architectural distortion, or suspicious calcifications. No skin thickening.',
    conclusion: 'Normal mammogram. BI-RADS 1.'
  },
  'X-Ray Cervical Spine': {
    clinicalIndication: 'Neck pain, trauma, whiplash, radiculopathy, rule out fracture or dislocation',
    technique: 'Standard cervical spine series: AP, lateral, open-mouth odontoid, and oblique views. Lateral view must include C7-T1 junction.',
    findings: 'Normal cervical spine alignment. Vertebral bodies are normal in height and alignment. No fracture or dislocation. Disc spaces are preserved. Prevertebral soft tissues normal.',
    conclusion: 'Normal cervical spine X-ray.'
  },
  'X-Ray Lumbar Spine': {
    clinicalIndication: 'Low back pain, sciatica, trauma, rule out fracture, spondylolysis, or listhesis',
    technique: 'Standard lumbar spine series: AP, lateral, and spot lateral views of the lumbosacral junction. Coned view of L5-S1.',
    findings: 'Normal lumbar spine alignment. Vertebral bodies normal. No fracture, spondylolysis, or spondylolisthesis. Disc spaces preserved. Pedicles intact.',
    conclusion: 'Normal lumbar spine X-ray.'
  },
  'X-Ray Pelvis': {
    clinicalIndication: 'Hip pain, trauma, fall, suspected fracture, hip dysplasia, arthritis evaluation',
    technique: 'Standard AP pelvis radiograph. Includes both hip joints and proximal femora.',
    findings: 'Normal pelvic alignment. Sacroiliac joints normal. Hip joints normal with preserved joint spaces. No fracture or dislocation. No abnormal calcifications.',
    conclusion: 'Normal pelvic X-ray.'
  },
  'X-Ray Shoulder': {
    clinicalIndication: 'Shoulder pain, trauma, fall on outstretched hand, suspected dislocation or fracture',
    technique: 'Standard shoulder series: AP internal and external rotation, scapular Y view, and axillary lateral view.',
    findings: 'Normal glenohumeral joint. No fracture or dislocation. Acromioclavicular joint normal. No soft tissue abnormality.',
    conclusion: 'Normal shoulder X-ray.'
  },
  'X-Ray Knee': {
    clinicalIndication: 'Knee pain, trauma, swelling, locking, rule out fracture or joint effusion',
    technique: 'Standard knee series: AP weight-bearing, lateral, and patellar (sunrise) views.',
    findings: 'Normal knee alignment. Joint space preserved. No fracture or dislocation. No effusion. Patella normally positioned.',
    conclusion: 'Normal knee X-ray.'
  },
  'X-Ray Wrist': {
    clinicalIndication: 'Wrist pain after fall, trauma, suspected scaphoid fracture, arthritis evaluation',
    technique: 'Standard wrist series: PA, lateral, and oblique views.',
    findings: 'Normal carpal alignment. No fracture or dislocation. Joint spaces preserved. No abnormal calcifications.',
    conclusion: 'Normal wrist X-ray.'
  },
  'X-Ray Skull': {
    clinicalIndication: 'Head trauma, headache, suspected skull fracture, sinusitis evaluation',
    technique: 'Standard skull series: PA, lateral, and Towne views.',
    findings: 'Normal skull radiograph. No fracture. Sella turcica normal. Pineal gland calcification midline. No intracranial calcifications.',
    conclusion: 'Normal skull X-ray.'
  },
  'X-Ray Sinuses': {
    clinicalIndication: 'Facial pain, headache, nasal congestion, suspected sinusitis',
    technique: 'Standard sinus series: occipitomental (Waters), PA (Caldwell), and lateral views.',
    findings: 'Normal paranasal sinuses. Frontal, maxillary, ethmoid, and sphenoid sinuses are well-aerated. No mucosal thickening or air-fluid levels.',
    conclusion: 'Normal sinus X-ray.'
  },
  'Ultrasound Renal': {
    clinicalIndication: 'Flank pain, hematuria, suspected kidney stones, renal failure, UTI evaluation',
    technique: 'Renal ultrasound with gray-scale and color Doppler. Longitudinal and transverse views of both kidneys. Bladder scan post-void.',
    findings: 'Both kidneys normal in size, shape, and position. Normal corticomedullary differentiation. No hydronephrosis, stone, or mass. Bladder wall normal, no residual urine.',
    conclusion: 'Normal renal ultrasound.'
  },
  'Ultrasound Scrotum': {
    clinicalIndication: 'Testicular pain, swelling, mass, trauma, infertility workup, suspected torsion or epididymitis',
    technique: 'High-resolution ultrasound of the scrotum with color Doppler. Linear array transducer. Both testes compared.',
    findings: 'Testes normal in size, shape, and echotexture bilaterally. Epididymis normal. No hydrocele, varicocele, or mass. Normal vascular flow on Doppler.',
    conclusion: 'Normal scrotal ultrasound.'
  },
  'Ultrasound Transvaginal': {
    clinicalIndication: 'Pelvic pain, abnormal uterine bleeding, infertility evaluation, ovarian cyst follow-up',
    technique: 'Transvaginal ultrasound using a high-frequency endocavitary transducer. Uterus and adnexa evaluated in sagittal and coronal planes.',
    findings: 'Uterus normal size and contour. Endometrium normal thickness. Ovaries normal in size and appearance. No adnexal mass or free fluid.',
    conclusion: 'Normal transvaginal ultrasound.'
  },
  'Ultrasound Soft Tissue': {
    clinicalIndication: 'Palpable mass, swelling, suspected abscess, cellulitis, foreign body evaluation',
    technique: 'High-resolution ultrasound of the symptomatic area using a linear array transducer. Gray-scale and color Doppler evaluation.',
    findings: 'Subcutaneous tissues normal. No fluid collection, mass, or abscess identified. No increased vascularity.',
    conclusion: 'Normal soft tissue ultrasound.'
  },
  'Ultrasound Neck': {
    clinicalIndication: 'Neck mass, lymph node evaluation, suspected thyroid or salivary gland pathology',
    technique: 'High-resolution ultrasound of the neck. Linear array transducer. Gray-scale and color Doppler evaluation of lymph node stations and salivary glands.',
    findings: 'Normal lymph nodes present. Salivary glands normal. No cystic or solid neck mass. No abnormal vascularity.',
    conclusion: 'Normal neck ultrasound.'
  },
  'CT Scan Chest': {
    clinicalIndication: 'Persistent cough, hemoptysis, suspected mass, pulmonary embolus, staging of known malignancy',
    technique: 'Contrast-enhanced CT chest. Multiplanar reconstructions. Lung and mediastinal windows. 1.25mm slice thickness for lung evaluation.',
    findings: 'Normal chest CT. Lungs clear with no consolidation, mass, or nodule. No pleural effusion. Mediastinum normal. No lymphadenopathy.',
    conclusion: 'Normal CT chest.'
  },
  'CT Scan Pelvis': {
    clinicalIndication: 'Pelvic pain, suspected mass, trauma, bladder or gynecologic pathology',
    technique: 'Contrast-enhanced CT pelvis. Multiplanar reconstructions. Bladder adequately distended.',
    findings: 'Normal pelvic CT. Bladder normal. Uterus/prostate normal. No pelvic mass or lymphadenopathy. No free fluid.',
    conclusion: 'Normal CT pelvis.'
  },
  'CT Scan Lumbar Spine': {
    clinicalIndication: 'Low back pain with radiculopathy, suspected disc herniation, spinal stenosis, trauma',
    technique: 'Non-contrast CT lumbar spine. Sagittal and axial reconstructions. Bone and soft tissue windows.',
    findings: 'Normal lumbar spine CT. Vertebral bodies and posterior elements intact. No fracture. No spinal stenosis. No disc herniation.',
    conclusion: 'Normal CT lumbar spine.'
  },
  'CT Scan Sinuses': {
    clinicalIndication: 'Chronic sinusitis, recurrent sinus infections, nasal polyps, facial pain',
    technique: 'Non-contrast CT sinuses. Coronal and axial reconstructions. Bone window algorithm.',
    findings: 'Normal CT sinuses. All paranasal sinuses well-aerated. No mucosal thickening or opacification. Ostial drainage pathways patent. No polyps or mass.',
    conclusion: 'Normal CT sinuses.'
  },
  'CT Coronary Angiography': {
    clinicalIndication: 'Chest pain, suspected coronary artery disease, atypical angina, pre-operative cardiac evaluation',
    technique: 'ECG-gated coronary CTA with contrast. Prospective or retrospective gating. Calcium scoring performed.',
    findings: 'Normal coronary CTA. No significant coronary artery stenosis. Left main, LAD, LCX, and RCA patent. Normal cardiac function.',
    conclusion: 'Normal coronary CTA.'
  },
  'CT Urogram': {
    clinicalIndication: 'Hematuria, suspected renal mass, urinary tract obstruction, recurrent UTIs',
    technique: 'CT urogram protocol: non-contrast, nephrographic, and excretory phases. Multiplanar reconstructions. Ureteric compression used.',
    findings: 'Normal CT urogram. Kidneys enhance symmetrically. No hydronephrosis. Ureters normal caliber. Bladder normal. No filling defects.',
    conclusion: 'Normal CT urogram.'
  },
  'MRI Cervical Spine': {
    clinicalIndication: 'Neck pain with radiculopathy, myelopathy, suspected disc herniation, spinal cord compression',
    technique: 'Cervical spine MRI with and without contrast. Sagittal T1, T2, STIR. Axial T2 GRE and T1 through disc levels.',
    findings: 'Normal cervical spine MRI. Normal alignment. Discs normal signal and height. No disc herniation or spinal stenosis. Spinal cord normal caliber and signal. No cord compression.',
    conclusion: 'Normal MRI cervical spine.'
  },
  'MRI Lumbar Spine': {
    clinicalIndication: 'Low back pain with radiculopathy, sciatica, suspected disc herniation, spinal stenosis',
    technique: 'Lumbar spine MRI without contrast. Sagittal T1, T2, STIR. Axial T2 and T1 through disc levels. Includes conus medullaris.',
    findings: 'Normal lumbar spine MRI. Normal alignment. Discs normal signal and height. No disc herniation or spinal stenosis. Conus medullaris normal. No nerve root impingement.',
    conclusion: 'Normal MRI lumbar spine.'
  },
  'MRI Shoulder': {
    clinicalIndication: 'Shoulder pain, instability, rotator cuff injury, suspected labral tear, adhesive capsulitis',
    technique: 'Shoulder MRI without contrast. Axial, coronal oblique, and sagittal oblique planes. T1, T2 fat-sat, and PD sequences.',
    findings: 'Normal shoulder MRI. Rotator cuff tendons intact. No tear. Labrum normal. Glenohumeral joint normal. No effusion or loose bodies.',
    conclusion: 'Normal MRI shoulder.'
  },
  'MRI Knee': {
    clinicalIndication: 'Knee pain, locking, giving way, suspected meniscal or ligamentous injury, post-traumatic evaluation',
    technique: 'Knee MRI without contrast. Sagittal, coronal, and axial planes. T1, T2 fat-sat, and PD sequences.',
    findings: 'Normal knee MRI. Medial and lateral menisci intact. Cruciate and collateral ligaments intact. Articular cartilage normal. No joint effusion.',
    conclusion: 'Normal MRI knee.'
  },
  'MRI Abdomen': {
    clinicalIndication: 'Abdominal mass, liver lesion, pancreatic pathology, biliary disease, cancer staging',
    technique: 'Abdominal MRI with and without contrast. Axial T1 in/opposed phase, T2, DWI, and post-contrast dynamic phases. MRCP sequences included.',
    findings: 'Normal abdominal MRI. Liver, pancreas, spleen, kidneys, and adrenal glands normal. No mass or lesion. Biliary tree normal. No lymphadenopathy.',
    conclusion: 'Normal MRI abdomen.'
  },
  'MRI Pelvis': {
    clinicalIndication: 'Pelvic mass, cancer staging, infertility, endometriosis, prostate evaluation',
    technique: 'Pelvic MRI with and without contrast. Axial T1, T2, DWI, and post-contrast sequences. Sagittal and coronal planes.',
    findings: 'Normal pelvic MRI. Uterus/prostate normal. Ovaries/seminal vesicles normal. No pelvic mass. No lymphadenopathy. No free fluid.',
    conclusion: 'Normal MRI pelvis.'
  },
  'MRCP': {
    clinicalIndication: 'Biliary obstruction, jaundice, suspected choledocholithiasis, recurrent pancreatitis',
    technique: 'MRCP performed as part of abdominal MRI. Thick-slab and thin-slice heavily T2-weighted sequences in multiple planes. No contrast needed.',
    findings: 'Normal MRCP. Intrahepatic and extrahepatic bile ducts normal caliber. Common bile duct normal. Gallbladder normal with no stones. Pancreatic duct normal.',
    conclusion: 'Normal MRCP.'
  },
  'Bone Scan': {
    clinicalIndication: 'Metastatic workup, occult fracture, bone infection, Paget disease, arthralgia evaluation',
    technique: 'Whole-body bone scan. 20 mCi Tc-99m MDP administered IV. Delayed images 2-3 hours post injection. Additional SPECT/CT as needed.',
    findings: 'Normal whole-body bone scan. Symmetric radiotracer uptake throughout the axial and appendicular skeleton. No foci of abnormal uptake.',
    conclusion: 'Normal bone scan.'
  },
  'PET/CT Scan': {
    clinicalIndication: 'Cancer staging, treatment response assessment, restaging, suspected recurrence, fever of unknown origin',
    technique: 'Whole-body FDG PET/CT. 10-15 mCi FDG administered IV after 6-hour fast. Uptake period 60 minutes. Low-dose CT for attenuation correction and anatomic correlation.',
    findings: 'Normal PET/CT. No abnormal FDG uptake identified. Minimal physiologic activity in brain, myocardium, and excretory tract. No hypermetabolic lesions.',
    conclusion: 'Normal PET/CT.'
  },
  'Thyroid Scan': {
    clinicalIndication: 'Thyroid nodule evaluation, hyperthyroidism, thyroiditis, ectopic thyroid tissue',
    technique: 'Thyroid scan. 5-10 mCi Tc-99m pertechnetate administered IV. Planar images of the thyroid bed acquired 20 minutes post injection.',
    findings: 'Normal thyroid scan. Homogeneous radiotracer uptake in both thyroid lobes. No cold or hot nodules. Normal size and configuration.',
    conclusion: 'Normal thyroid scan.'
  },
  'Barium Swallow': {
    clinicalIndication: 'Dysphagia, odynophagia, reflux, suspected esophageal stricture or motility disorder',
    technique: 'Fluoroscopic barium swallow. Patient swallows liquid and paste barium. Multiple projections. Esophageal motility assessed.',
    findings: 'Normal barium swallow. Oral and pharyngeal phases normal. Barium flows freely through the esophagus. No stricture, diverticulum, or reflux. Normal esophageal motility.',
    conclusion: 'Normal barium swallow.'
  },
  'Upper GI Series': {
    clinicalIndication: 'Epigastric pain, dyspepsia, nausea, vomiting, suspected ulcer or gastric mass',
    technique: 'Fluoroscopic upper GI series. Patient ingests barium. Spot images of esophagus, stomach, and duodenum. Compression views of duodenal bulb.',
    findings: 'Normal upper GI series. Esophagus, stomach, and duodenum normal. No ulcer, mass, or stricture. Gastric emptying normal. Duodenal bulb well-distended.',
    conclusion: 'Normal upper GI series.'
  },
  'Barium Enema': {
    clinicalIndication: 'Change in bowel habits, rectal bleeding, suspected colon mass or stricture, chronic constipation',
    technique: 'Fluoroscopic barium enema. Single or double contrast. Barium instilled per rectum. Spot images of entire colon and rectum.',
    findings: 'Normal barium enema. Colon well-distended. No stricture, mass, or diverticula. Mucosa normal. Terminal ileum fills normally.',
    conclusion: 'Normal barium enema.'
  },
  'Hysterosalpingography (HSG)': {
    clinicalIndication: 'Infertility workup, suspected tubal obstruction, recurrent pregnancy loss, post-tubal ligation confirmation',
    technique: 'Fluoroscopic hysterosalpingography. Contrast instilled through cervical cannula. Spot images of uterine cavity and fallopian tubes.',
    findings: 'Normal HSG. Uterine cavity normal in shape and contour. Fallopian tubes patent bilaterally with free intraperitoneal spillage.',
    conclusion: 'Normal HSG.'
  },
  'DEXA Bone Density': {
    clinicalIndication: 'Osteoporosis screening, fracture risk assessment, treatment monitoring, prolonged corticosteroid use',
    technique: 'Dual-energy X-ray absorptiometry of lumbar spine (L1-L4) and left hip (femoral neck and total hip). Standard WHO criteria applied.',
    findings: 'Normal bone density. Lumbar spine and hip BMD within normal range. T-score above -1.0.',
    conclusion: 'Normal bone density. No osteoporosis.'
  },
  'Arthrogram': {
    clinicalIndication: 'Joint pain, suspected labral tear, ligamentous injury, loose bodies, post-surgical evaluation',
    technique: 'Fluoroscopic arthrogram. Contrast injected into the joint space under sterile conditions. Spot images obtained. Post-procedure MRI may follow.',
    findings: 'Normal arthrogram. Joint cavity well-distended. No contrast leakage. No loose bodies or filling defects. Normal appearance of intra-articular structures.',
    conclusion: 'Normal arthrogram.'
  },
  'Myelogram': {
    clinicalIndication: 'Spinal stenosis, nerve root compression, suspected intraspinal mass, pre-operative spinal evaluation',
    technique: 'Fluoroscopic myelogram. Lumbar puncture performed. Contrast injected into subarachnoid space. Spot images of entire spine. Post-myelogram CT may follow.',
    findings: 'Normal myelogram. Contrast flows freely through subarachnoid space. No obstruction or block. Nerve root sleeves fill normally. No extradural compression.',
    conclusion: 'Normal myelogram.'
  },
  'X-Ray Thoraco-Lumbar Spine': {
    clinicalIndication: 'Mid-back and low back pain, trauma, fall, suspected vertebral compression fracture',
    technique: 'Standard thoraco-lumbar spine series: AP and lateral views. Coned lateral view of the thoracolumbar junction.',
    findings: 'Normal thoraco-lumbar spine alignment. Vertebral body heights are preserved. No fracture or dislocation. Disc spaces are maintained.',
    conclusion: 'Normal thoraco-lumbar spine X-ray.'
  },
  'X-Ray Lumbo-Sacral Spine': {
    clinicalIndication: 'Low back pain, sacral pain, trauma, suspected spondylolysis or sacroiliac joint dysfunction',
    technique: 'Standard lumbo-sacral spine series: AP, lateral, and coned lateral view of the lumbosacral junction.',
    findings: 'Normal lumbo-sacral spine alignment. Vertebral bodies normal in height and alignment. Disc spaces preserved. Sacroiliac joints normal.',
    conclusion: 'Normal lumbo-sacral spine X-ray.'
  },
  'X-Ray Elbow': {
    clinicalIndication: 'Elbow pain after fall, trauma, suspected fracture, tennis elbow evaluation',
    technique: 'Standard elbow series: AP, lateral, and oblique views.',
    findings: 'Normal elbow joint alignment. No fracture or dislocation. Joint spaces are preserved. No soft tissue abnormality.',
    conclusion: 'Normal elbow X-ray.'
  },
  'X-Ray Leg': {
    clinicalIndication: 'Leg pain after trauma, suspected tibia or fibula fracture, shin splints, deformity evaluation',
    technique: 'Standard leg series: AP and lateral views of the tibia and fibula. Includes knee and ankle joints.',
    findings: 'Normal alignment of the tibia and fibula. No fracture or periosteal reaction. No bone lesions. Joint spaces preserved.',
    conclusion: 'Normal leg X-ray.'
  },
  'X-Ray Hand': {
    clinicalIndication: 'Hand pain after trauma, suspected fracture, arthritis evaluation, foreign body',
    technique: 'Standard hand series: PA, oblique, and lateral views.',
    findings: 'Normal hand and finger bones. No fracture or dislocation. Joint spaces preserved. No erosive changes.',
    conclusion: 'Normal hand X-ray.'
  },
  'X-Ray Forearm': {
    clinicalIndication: 'Forearm pain after fall, suspected radius or ulna fracture, deformity',
    technique: 'Standard forearm series: AP and lateral views of the radius and ulna. Includes wrist and elbow.',
    findings: 'Normal alignment of the radius and ulna. No fracture or dislocation. No bone lesions.',
    conclusion: 'Normal forearm X-ray.'
  },
  'X-Ray Ankle': {
    clinicalIndication: 'Ankle pain after trauma, sprain, suspected fracture, instability evaluation',
    technique: 'Standard ankle series: AP, lateral, and mortise views.',
    findings: 'Normal ankle joint alignment. No fracture or dislocation. Joint spaces preserved. No soft tissue swelling.',
    conclusion: 'Normal ankle X-ray.'
  },
  'X-Ray Foot': {
    clinicalIndication: 'Foot pain after trauma, suspected fracture, arch pain, foreign body',
    technique: 'Standard foot series: AP, lateral, and oblique views.',
    findings: 'Normal foot bones and alignment. No fracture or dislocation. Joint spaces preserved. No bony abnormality.',
    conclusion: 'Normal foot X-ray.'
  },
  // Types that need NEW templates (no template existed before):
  'Ultrasound - Abdomen': {
    clinicalIndication: 'Right upper quadrant pain, jaundice, abdominal mass, rule out gallstones or liver disease',
    technique: 'Gray-scale and color Doppler ultrasound of the abdomen. Patient fasting. Convex transducer used.',
    findings: 'Liver: normal size and echotexture. Gallbladder: normal wall thickness, no stones. Pancreas: normal. Spleen: normal. Kidneys: normal. No hydronephrosis.',
    conclusion: 'Normal abdominal ultrasound.'
  },
  'Ultrasound - Pelvis': {
    clinicalIndication: 'Pelvic pain, abnormal bleeding, palpable mass, routine gynecologic evaluation',
    technique: 'Transabdominal and transvaginal pelvic ultrasound. Bladder adequately distended.',
    findings: 'Uterus: normal size and contour. Endometrium: normal thickness. Ovaries: normal size. No adnexal mass or free fluid.',
    conclusion: 'Normal pelvic ultrasound.'
  },
  'Obstetric Ultrasound': {
    clinicalIndication: 'Routine prenatal screening, dating, viability assessment, bleeding in pregnancy',
    technique: 'Standard obstetric ultrasound protocol. Transabdominal approach. Fetal biometry and anatomy survey.',
    findings: 'Single viable intrauterine pregnancy. Fetal heart rate: normal. Placenta: normal position. Amniotic fluid: normal volume.',
    conclusion: 'Normal obstetric ultrasound.'
  },
  'Thyroid Ultrasound': {
    clinicalIndication: 'Thyroid nodule, goiter, neck swelling, hyperthyroidism or hypothyroidism evaluation',
    technique: 'High-resolution ultrasound of the thyroid. Linear transducer. Transverse and longitudinal views. Color Doppler.',
    findings: 'Thyroid gland: normal size and echotexture. No nodule or cyst. No abnormal vascularity.',
    conclusion: 'Normal thyroid ultrasound.'
  },
  'Breast Ultrasound': {
    clinicalIndication: 'Breast lump, mastalgia, screening, follow-up of prior finding',
    technique: 'Whole breast ultrasound. High-frequency linear array transducer. Radial and anti-radial scanning.',
    findings: 'Breast parenchyma: normal. No mass, cyst, or abnormal calcification. No axillary lymphadenopathy.',
    conclusion: 'Normal breast ultrasound.'
  },
  'Doppler Ultrasound': {
    clinicalIndication: 'Peripheral vascular disease, DVT evaluation, arterial insufficiency, varicose veins',
    technique: 'Color and spectral Doppler ultrasound. Grayscale imaging with compression technique.',
    findings: 'Normal flow patterns in examined vessels. No stenosis, occlusion, or thrombus. Normal waveforms bilaterally.',
    conclusion: 'Normal Doppler study.'
  }
};
