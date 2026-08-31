import json
from pathlib import Path

OUT=Path('/mnt/data/rainbow_lms_app/data/course_catalog.json')
review='2026-08-31'

category_defaults={
 'Water Mitigation':{
  'steps':['Complete a site-specific safety review before disturbing materials.','Confirm the source, affected boundaries, contamination conditions, and the approved scope.','Use the assigned extraction, drying, cleaning, or removal procedure and reassess when conditions change.','Record readings, photographs, equipment, decisions, communications, and exceptions in company systems.'],
  'docs':['Initial conditions and source notes','Moisture map and daily readings','Equipment or work performed','Photos, authorizations, and closeout notes'],
  'roles':['water','project_manager']},
 'Systems & Documentation':{
  'steps':['Open the correct job and confirm customer, loss, and assignment information.','Enter information in the required field, room, material, or document location.','Review entries for accuracy, timestamps, duplicates, and missing records.','Synchronize or upload the record and notify the supervisor when the system or workflow fails.'],
  'docs':['Job identifier and date','Clear notes tied to the correct room or item','Required photos or attachments','Supervisor escalation for missing or corrected information'],
  'roles':['water','fire','mold','contents','project_manager']},
 'Fire & Smoke':{
  'steps':['Confirm structural, electrical, chemical, respiratory, and re-entry hazards before work.','Inspect and test residues and surfaces before selecting a cleaning method.','Work from the least aggressive effective method to more aggressive methods with supervisor approval.','Document tests, results, limitations, odor sources, cleaning actions, and customer communications.'],
  'docs':['Pre-cleaning condition photos','Residue or cleaning tests','Cleaning and deodorization methods','Unresolved damage and handoff notes'],
  'roles':['fire','contents','project_manager']},
 'Mold Remediation':{
  'steps':['Confirm the approved work plan, containment boundaries, HVAC status, and stop-work triggers.','Establish engineering controls and required PPE before disturbance.','Remove or clean materials using dust-minimizing and HEPA-based work practices.','Perform detailed cleaning, document completion, and preserve the area for required verification.'],
  'docs':['Work plan and containment setup','Daily pressure or equipment checks','Materials removed or cleaned','Final cleaning and verification records'],
  'roles':['mold','water','project_manager']},
 'Contents Restoration':{
  'steps':['Assess hazards, item condition, customer priorities, and special handling needs.','Photograph, identify, and inventory items before movement.','Pack, transport, clean, dry, store, and return items using chain-of-custody controls.','Reconcile the inventory and document missing, damaged, non-salvageable, or unresolved items.'],
  'docs':['Room and item inventory','Pre-existing condition photos','Cleaning, storage, and movement records','Pack-back reconciliation and customer acknowledgment'],
  'roles':['contents','fire','warehouse','project_manager']},
 'Asbestos':{
  'steps':['Stop disturbance when suspect material, PACM, damaged ACM, or an incomplete survey is identified.','Confirm the survey, classification, licensed personnel, competent person, notifications, and approved work plan before regulated work.','Use the required regulated area, engineering controls, PPE, respiratory protection, hygiene, and waste procedures.','Maintain exposure, training, medical, fit-test, air monitoring, waste, and project records required by the applicable program.'],
  'docs':['Survey and material identification','Worker, supervisor, license, and training verification','Air monitoring, regulated-area, and daily records','Waste shipment and final project documentation'],
  'roles':['asbestos','project_manager']},
 'OSHA & Safety':{
  'steps':['Recognize the task-specific hazard before beginning work.','Use the hierarchy of controls, required safeguards, and assigned PPE.','Inspect tools, equipment, access, and the work area before use and when conditions change.','Stop work, protect others, report the condition, and document required training or incident information.'],
  'docs':['Hazard or pre-task assessment','Inspection or authorization record','Training and competency verification','Incident, corrective action, or supervisor notification'],
  'roles':['all']},
 'Leadership & Compliance':{
  'steps':['Identify the applicable program, competent person, records, and employee groups.','Verify training, medical, licensing, equipment, and authorization prerequisites.','Audit field implementation and correct gaps promptly.','Retain current records and review the program after changes, incidents, or identified deficiencies.'],
  'docs':['Program review and responsible person','Training matrix and authorization status','Audit findings and corrective actions','Retention and regulatory review record'],
  'roles':['project_manager','admin']},
}

courses=[]

def add(slug,title,cat,desc,keys,minutes=35,renewal=12,roles=None,basis='',warning='',points=100,required=False,steps=None,docs=None,tags=None,delivery='native',legacyPath=None,passing=80):
    d=category_defaults[cat]
    roles=roles or d['roles']
    steps=steps or d['steps']
    docs=docs or d['docs']
    keys=list(keys)
    objectives=[f'Explain {keys[0][0].lower()+keys[0][1:] if keys else title.lower()}.',f'Apply the approved Rainbow Restoration work sequence for {title.lower()}.','Recognize stop-work conditions and create a complete training or job record.']
    lessons=[]
    if delivery=='native':
        lessons=[
          {'title':'Purpose, scope, and learning objectives','summary':desc,'bullets':objectives,'callout':'This is internal company training. Follow current company programs, site-specific instructions, manufacturer information, and applicable law.'},
          {'title':'Recognize the hazard or work condition','summary':f'Technicians must understand the conditions that control the work before beginning {title.lower()}.','bullets':keys,'callout':'When the condition cannot be confidently classified or controlled, pause the task and obtain supervisor or competent-person review.'},
          {'title':'Approved field workflow','summary':'Use a repeatable sequence that protects people, property, evidence, and the job record.','bullets':steps,'callout':'Never bypass a required survey, authorization, medical clearance, fit test, license, competent person, or equipment inspection.'},
          {'title':'Documentation, verification, and closeout','summary':'The record must show what was found, what was decided, what was done, and who verified completion.','bullets':docs,'callout':warning or 'Course completion documents internal training only and does not replace a license, outside certification, or site-specific authorization when one is required.'},
        ]
        good1=keys[0] if keys else desc
        good2=steps[0]
        good3=docs[0]
        quiz=[
          {'question':f'Which statement is a key principle of {title}?','options':[good1,'Begin work before evaluating hazards so production is not delayed.','Use the same controls on every project without reassessment.','Rely only on memory instead of the approved procedure.'],'answer':0,'rationale':good1,'critical':False},
          {'question':'What is the correct response when conditions are unknown, outside the approved scope, or cannot be safely controlled?','options':['Continue briefly and reassess later.','Stop work, protect the area, and notify the supervisor or designated competent person.','Ask the customer to select the PPE.','Remove the material before photographing it.'],'answer':1,'rationale':'Unknown or uncontrolled conditions require stop-work, isolation when needed, and reassessment by an authorized person.','critical':True},
          {'question':f'Which action belongs in the approved work sequence for this course?','options':['Skip the pre-task review when the job is urgent.',good2,'Discard damaged equipment only after the shift.','Change the scope without communicating the reason.'],'answer':1,'rationale':good2,'critical':False},
          {'question':'Which item supports a defensible training or job record?','options':['An undocumented verbal assumption.',good3,'Deleting photographs that show changed conditions.','Entering all rooms under one generic note.'],'answer':1,'rationale':f'The record should include {good3.lower()} and other course-specific documentation.','critical':False},
          {'question':'Does completion of this internal LMS course, by itself, grant a government license, third-party certification, medical clearance, fit test, or authorization for regulated work?','options':['Yes, for all restoration work.','Yes, when the quiz score is 100 percent.','No. Separate prerequisites and task-specific authorization still apply.','Only when the employee prints the certificate.'],'answer':2,'rationale':'Internal course completion is only one part of qualification and does not replace external credentials or site-specific authorization.','critical':True},
        ]
    else:
        objectives=[]; lessons=[]; quiz=[]
    courses.append({
      'slug':slug,'title':title,'category':cat,'description':desc,'estimatedMinutes':minutes,'passingScore':passing,
      'renewalMonths':renewal,'points':points,'requiredByDefault':required,'requiredRoles':roles,'regulatoryBasis':basis,
      'credentialWarning':warning,'reviewedOn':review,'tags':tags or [],'deliveryType':delivery,'legacyPath':legacyPath,
      'objectives':objectives,'lessons':lessons,'quiz':quiz,'active':True
    })

# Imported flagship modules
add('water-mitigation-new-hire','Water Mitigation New-Hire Fundamentals','Water Mitigation','The complete interactive water mitigation onboarding course supplied by Rainbow Restoration, including ten instructional modules, a final assessment, hands-on competency evaluation, and certificate.',[],240,0,['water','project_manager'],'ANSI/IICRC S500 topics; company procedures','Internal training only; not an IICRC WRT certification.',250,True,delivery='legacy',legacyPath='/courseware/water-mitigation-new-hire.html',passing=80,tags=['flagship','interactive','certificate'])
add('respiratory-protection-interactive','Respiratory Protection Interactive Training','OSHA & Safety','The complete supplied respiratory protection course with medical-evaluation and fit-testing prerequisites, respirator selection, use, care, task-specific hazards, exam, practical evaluation, acknowledgment, and annual certificate.',[],270,12,['water','fire','mold','asbestos','project_manager'],'29 CFR 1910.134; 29 CFR 1926.103','Course completion does not authorize respirator use without current medical clearance, fit testing, assigned equipment, and program authorization.',250,True,delivery='legacy',legacyPath='/courseware/respiratory-protection.html',passing=80,tags=['flagship','OSHA','annual','interactive'])

# Water mitigation and systems
add('water-loss-safety-response','Water Loss Safety & Initial Response','Water Mitigation','How to make a new water loss safe, confirm source status, protect occupants, establish work zones, and recognize immediate stop-work conditions.',[
 'Safety, source control, occupant protection, utilities, contamination, and structural conditions are evaluated before production work.',
 'A wet ceiling, energized equipment, chemical odor, unstable surface, or unknown contamination can require immediate withdrawal and escalation.',
 'The affected boundary is determined by inspection and measurement, not by visible staining alone.'],45,12,required=True,basis='29 CFR 1926.21; 29 CFR 1926 Subparts C, D, E, and K')
add('source-control-emergency-services','Source Control & Emergency Services','Water Mitigation','Initial stabilization, emergency extraction, source coordination, access limitations, and communication when the permanent repair is outside Rainbow’s assignment.',[
 'Mitigation personnel verify whether the source is stopped or controlled but do not perform unassigned licensed trade work.',
 'Emergency extraction is planned around electrical, structural, contamination, and access hazards.',
 'Temporary controls and limitations are documented and communicated to the customer and project manager.'],35,12)
add('water-inspection-scoping','Inspection, Scoping & Preliminary Determinations','Water Mitigation','A systematic inspection process for source, migration, materials, pre-existing conditions, customer priorities, dry standards, and proposed scope.',[
 'Inspection includes affected and potentially affected rooms, assemblies, contents, cavities, and lower levels.',
 'Preliminary determinations guide the need for remediation, restorative drying, removal, containment, or specialist referral.',
 'Scope decisions must be supported by photographs, readings, sketches, and notes.'],50,12,basis='ANSI/IICRC S500 topics; 29 CFR 1926.21')
add('water-category-class','Water Categories & Classes','Water Mitigation','Foundational use of water category and class concepts to recognize contamination risk, evaporation load, and changed conditions.',[
 'Category describes contamination characteristics and potential exposure risk; class describes the potential evaporation load and affected materials.',
 'Category can deteriorate as time, temperature, contaminants, or affected materials change.',
 'Contaminated losses require approved remediation controls before routine restorative drying.'],45,12,basis='ANSI/IICRC S500 topics; OSHA cleanup guidance')
add('protimeter-moisture-meters','Protimeter Moisture Meter Fundamentals','Water Mitigation','Hands-on use of pin, pinless, and relative modes on common Protimeter instruments, including material selection, reference readings, limitations, and care.',[
 'Meter mode and scale must match the instrument, material, and purpose of the reading.',
 'A dry standard or unaffected comparison helps establish a defensible drying goal.',
 'Readings are mapped consistently by room, material, depth, and date; a single number is not interpreted without context.'],55,12,basis='Manufacturer instructions; ANSI/IICRC S500 topics',warning='Follow the exact manufacturer manual for the assigned Protimeter model and probe.')
add('psychrometry-technicians','Psychrometry for Restoration Technicians','Water Mitigation','Practical temperature, relative humidity, humidity ratio, dew point, vapor pressure, and grain-depression concepts for monitoring a drying system.',[
 'Temperature and relative humidity must be interpreted together; relative humidity alone does not show the total moisture load.',
 'Psychrometric readings are collected in consistent locations and compared over time.',
 'Drying decisions use material readings and environmental data rather than a fixed number of days.'],60,12,basis='ANSI/IICRC S500 topics')
add('water-extraction','Water Extraction Systems & Techniques','Water Mitigation','Safe selection and operation of portable, truck-mounted, sub-surface, weighted, and specialty extraction tools.',[
 'Remove bulk water efficiently before relying on evaporation equipment.',
 'Inspect hoses, cords, wands, tanks, filters, grounding, and waste-water routing before use.',
 'Extraction technique is selected for the material, contamination condition, access, and approved scope.'],50,12,basis='29 CFR 1926 Subparts E, K, and I; manufacturer instructions')
add('selective-demolition-water','Selective Demolition & Material Decisions','Water Mitigation','Decision-making and safe work practices for baseboard, drywall, insulation, flooring, cabinets, and other wet assemblies.',[
 'Suspect asbestos, lead, silica, hidden utilities, structural components, and contamination are evaluated before disturbance.',
 'Removal is limited to the approved scope and the least destructive access that achieves the technical objective.',
 'Pre-removal conditions, measurements, cut lines, debris controls, and completed work are documented.'],55,12,basis='29 CFR 1926.850-860; 1926.62; 1926.1101; 1926.1153')
add('airmover-dehu-setup','Air Movers, Dehumidifiers & Air Filtration Setup','Water Mitigation','Selection, placement, electrical loading, ducting, filtration, security, and customer-safety considerations for drying equipment.',[
 'Equipment is placed to create effective air movement and dehumidification without creating trip, electrical, contamination, or security hazards.',
 'Circuit capacity, GFCI protection, cord condition, heat, noise, airflow obstruction, and condensate routing are checked.',
 'Equipment counts and placements are verified during each visit and changed based on measured performance.'],55,12,basis='29 CFR 1926 Subparts E and K; manufacturer instructions')
add('specialty-drying','Specialty Drying Systems','Water Mitigation','Awareness of wall, floor, cabinet, hardwood, mat, injection, desiccant, and heat-assisted drying systems and their authorization limits.',[
 'Specialty systems require assembly-specific inspection, approved equipment, monitoring points, and manufacturer procedures.',
 'Heat and pressure can create material, electrical, fire, contaminant-migration, and occupant hazards.',
 'Technicians use specialty systems only when trained and assigned.'],45,12,warning='This course is awareness-level unless the employee also completes equipment-specific hands-on qualification.')
add('daily-monitoring-adjustments','Daily Monitoring & Drying Adjustments','Water Mitigation','A repeatable visit workflow for safety, customer communication, equipment verification, moisture mapping, psychrometrics, cleaning, and adjustment.',[
 'Each visit begins with a changed-condition and safety review.',
 'Material readings and environmental conditions are trended against the drying goal.',
 'Plateaus, equipment failures, inaccessible materials, odors, growth, or category changes are escalated promptly.'],50,12)
add('category-2-3-water','Category 2 & 3 Water Procedures','Water Mitigation','Contaminated-water awareness, regulated work zones, PPE, hygiene, removal, cleaning, disinfection, cross-contamination control, and waste handling.',[
 'Assume floodwater and sewage are contaminated unless a competent evaluation establishes otherwise.',
 'Engineering controls, PPE, hand hygiene, sharps awareness, and clean/dirty separation are established before work.',
 'Restorative drying does not replace contamination removal and cleaning requirements.'],65,12,basis='OSHA cleanup guidance; 29 CFR 1910.1030 when occupational exposure exists; Hazard Communication and PPE standards')
add('water-closeout','Water Job Closeout & Customer Handoff','Water Mitigation','Final moisture verification, equipment removal, documentation review, unresolved-condition escalation, and professional customer communication.',[
 'Equipment is removed based on documented drying goals and company criteria, not time alone.',
 'Final readings, photos, equipment counts, documents, and remaining repair needs are reconciled.',
 'Technicians do not promise coverage, pricing, or outcomes outside their authority.'],35,12)
add('cotality-mitigate-setup','Cotality Mitigate: Job Setup & Workflow','Systems & Documentation','Company workflow for opening the correct job, confirming loss information, building the structure/room hierarchy, and initiating daily documentation in Cotality Mitigate.',[
 'Job identifiers, dates, source information, category/class, rooms, materials, and affected areas must be entered in the correct record.',
 'The room and material structure should support repeatable daily readings.',
 'Sync or access issues are documented and escalated rather than recreated in an unapproved record.'],45,12,basis='Rainbow Restoration company procedure; Cotality product workflow',warning='Screen names and features may change; follow current company configuration and vendor guidance.')
add('cotality-mitigate-moisture','Cotality Mitigate: Moisture Mapping & Daily Logs','Systems & Documentation','Consistent entry of moisture points, psychrometrics, equipment, notes, visits, drying goals, and final readings in Cotality Mitigate.',[
 'Each reading is tied to the correct room, material, location, date, and device or method where required.',
 'Daily records show trends and explain added, moved, removed, or failed equipment.',
 'Corrections preserve record integrity and are explained rather than hidden.'],50,12,basis='Rainbow Restoration company procedure; Cotality product workflow')
add('fusion-photo-document','Fusion: Photo & Document Workflow','Systems & Documentation','Rainbow’s Fusion workflow for organized job photographs, signed documents, sketches, reports, naming, notes, privacy, and closeout review.',[
 'Photo sets move from identifying context to wide, medium, detail, process, progress, and final views.',
 'Photos and documents are uploaded promptly to the correct job with enough context to be understood later.',
 'Records are not deleted or altered to conceal a mistake or changed condition.'],45,12,basis='Rainbow Restoration company procedure; supplied water mitigation module',required=True)

# Fire and smoke
add('fire-loss-safety','Fire & Smoke Loss Safety and Structural Awareness','Fire & Smoke','Entry and work-zone decisions following fire, smoke, suppression, or structural damage.',[
 'Fire scenes may contain structural instability, energized systems, toxic combustion products, sharp debris, hot spots, water damage, and criminal-investigation restrictions.',
 'Re-entry authority and the approved work area are confirmed before operations.',
 'Respiratory and skin protection are selected from the hazard assessment, not odor alone.'],55,12,basis='29 CFR 1926.21; OSHA cleanup guidance; 29 CFR 1910.134/1926.103')
add('combustion-residues','Combustion Residues, Soot & Ash','Fire & Smoke','Recognition of dry, oily, protein, synthetic, and mixed residues and why residue type affects health precautions and cleaning strategy.',[
 'Residue appearance, source material, heat, humidity, suppression water, and time influence behavior.',
 'Dry removal and HEPA capture generally precede wet cleaning when appropriate.',
 'Unknown chemicals, heavy metal concerns, battery fires, drug-lab indicators, or industrial residues require specialist evaluation.'],50,12)
add('fire-inspection-scope','Fire Damage Inspection & Scope Development','Fire & Smoke','Room-by-room and system-level inspection of source, heat, smoke movement, residues, corrosion risk, water damage, contents, and pre-existing conditions.',[
 'Smoke can migrate beyond visible staining through pressure, HVAC, chases, and openings.',
 'Test cleaning and representative sampling support scope decisions.',
 'The scope distinguishes cleaning, removal, specialty referral, reconstruction, and customer-selected items.'],55,12)
add('dry-soil-removal','HEPA Vacuuming & Dry Soil Removal','Fire & Smoke','Controlled dry removal of soot and particulate using HEPA vacuums, brushes, sponges, and surface-protection methods.',[
 'Agitation and vacuuming methods must avoid spreading residue or damaging fragile surfaces.',
 'HEPA equipment condition and filter handling are part of the exposure-control plan.',
 'Dry-cleaning results are tested and documented before wet chemistry is introduced.'],45,12,basis='29 CFR 1910.134; PPE and Hazard Communication; manufacturer instructions')
add('fire-wet-cleaning','Wet Cleaning, Degreasing & Surface Testing','Fire & Smoke','Selection and controlled use of detergents, degreasers, alkaline cleaners, solvents, and specialty products after compatibility testing.',[
 'Read the SDS and label before mixing, diluting, applying, or disposing of a product.',
 'Test an inconspicuous area and use the least aggressive effective chemistry and dwell time.',
 'Never mix incompatible products or use unapproved chemicals in occupied areas.'],55,12,basis='29 CFR 1910.1200; PPE standards')
add('odor-source-removal','Odor Source Removal & Deodorization','Fire & Smoke','Source removal, cleaning, ventilation, adsorption, thermal fogging awareness, ozone/hydroxyl awareness, and post-treatment verification.',[
 'Deodorization begins with removing or cleaning odor sources; fragrance is not source removal.',
 'Ozone, thermal fogging, and other specialized methods require product-specific controls, occupancy restrictions, and authorization.',
 'Odor observations, treatments, dwell time, ventilation, and re-entry criteria are documented.'],60,12,basis='Hazard Communication; respiratory/PPE requirements; manufacturer instructions',warning='Specialty deodorization equipment requires separate manufacturer and company authorization.')
add('fire-hvac','HVAC and Mechanical System Considerations','Fire & Smoke','Awareness of smoke migration through HVAC systems, shutdown coordination, filter handling, access limits, and specialty cleaning referral.',[
 'HVAC status and system zones are documented before manipulating equipment.',
 'Mechanical, electrical, refrigerant, duct, and asbestos hazards may require licensed or specialized contractors.',
 'Cleaning decisions are based on inspection, contamination, system design, and approved scope.'],40,12)
add('fire-contents-triage','Fire-Damaged Contents Triage','Fire & Smoke','Rapid classification of contents for on-site cleaning, pack-out, specialty referral, disposal recommendation, or preservation.',[
 'Safety, ownership, sentimental value, replaceability, contamination, material sensitivity, and cost are considered.',
 'Items are not discarded without required documentation and customer/adjuster authorization.',
 'High-value, firearms, medications, currency, documents, electronics, and biohazard items follow special controls.'],50,12)
add('fire-closeout','Fire Job Documentation & Handoff','Fire & Smoke','Completion records for cleaning tests, rooms, contents, odor treatments, exclusions, remaining repairs, and customer communication.',[
 'The record identifies what was cleaned, removed, treated, deferred, or referred.',
 'Unresolved staining, corrosion, odor, access, and material damage are escalated before closeout.',
 'Final photographs and customer handoff notes match the approved scope.'],35,12)

# Mold
add('mold-awareness','Mold Awareness and Health/Safety','Mold Remediation','Basic mold conditions, moisture sources, exposure routes, health considerations, work limitations, and stop-work criteria.',[
 'Moisture control is fundamental; visible growth and odor may indicate a larger hidden condition.',
 'Employees should not make medical claims or identify species by appearance.',
 'Disturbance can aerosolize spores, fragments, dust, and contaminated debris.'],45,12,basis='OSHA mold guidance; 29 CFR 1926.21, Hazard Communication, PPE, and respiratory protection')
add('mold-work-planning','Mold Assessment, Conditions & Work Planning','Mold Remediation','Using the approved assessment, scope, containment plan, material decisions, occupant restrictions, and verification criteria.',[
 'The remediator follows the approved scope and reports conflicts or changed conditions.',
 'Suspect asbestos, lead, sewage, structural damage, chemical contamination, and HVAC involvement can change the plan.',
 'Work zones and pathways are planned to prevent cross-contamination.'],55,12,basis='ANSI/IICRC S520 topics; OSHA mold guidance')
add('mold-containment','Containment & Pressure Control','Mold Remediation','Building source, local, or full containment; critical barriers; negative pressure; air pathways; monitoring; and emergency response.',[
 'Containment is sized and built for the work, building configuration, occupant protection, and pressure-control objective.',
 'Critical barriers, entries, waste routes, and air-device exhaust are checked before disturbance.',
 'Loss of pressure, barrier damage, power failure, or occupant entry requires prompt correction and documentation.'],60,12)
add('hepa-air-scrubbing','HEPA Filtration & Air Scrubbing','Mold Remediation','Selection, placement, ducting, pressure use, filter changes, electrical safety, and verification for HEPA air-filtration devices.',[
 'Air devices are not a substitute for source removal and detailed cleaning.',
 'Pre-filters and HEPA filters are handled to avoid contaminant release.',
 'Airflow, pressure, filter condition, exhaust location, and equipment operation are documented.'],50,12,basis='OSHA mold guidance; respiratory/PPE standards; manufacturer instructions')
add('mold-remediation-practices','Mold Remediation Work Practices','Mold Remediation','Controlled removal, HEPA vacuuming, damp wiping, cleaning, sanding/abrasion limits, debris handling, and clean/dirty practices.',[
 'Methods minimize dust and cross-contamination while achieving the approved removal or cleaning objective.',
 'Compressed air and dry sweeping are not used to spread contamination.',
 'Employees exit, decontaminate, and change PPE using the approved sequence.'],65,12,basis='OSHA mold remediation guidance; ANSI/IICRC S520 topics')
add('mold-contents','Mold-Impacted Contents & Porous Material Decisions','Mold Remediation','Triage and handling of porous, semi-porous, non-porous, sentimental, and specialty contents affected by mold or prolonged moisture.',[
 'Item decisions consider material, extent, condition, cleanability, value, customer priorities, and approved scope.',
 'Contents moving through clean areas are contained and exterior surfaces cleaned as required.',
 'Specialty items are referred rather than damaged by an unapproved method.'],45,12)
add('post-remediation-cleaning','Post-Remediation Cleaning & Verification Readiness','Mold Remediation','Detailed cleaning sequence, visible-dust criteria, moisture correction, containment maintenance, and preservation for third-party verification.',[
 'The work area is clean, dry, and free of visible debris before verification or release.',
 'Containment is not removed before required inspection or clearance is complete.',
 'Failed verification or changed conditions are documented and corrected under an approved plan.'],50,12)
add('mold-documentation','Mold Project Documentation','Mold Remediation','Work plans, daily logs, pressure records, moisture information, photos, material quantities, waste, communications, and final records.',[
 'Records distinguish observations from laboratory or assessor conclusions.',
 'Daily logs show containment, equipment, work performed, changes, incidents, and personnel.',
 'Final documentation supports verification and customer/project-manager handoff.'],40,12)

# Contents
add('contents-safety-triage','Contents Safety & Triage','Contents Restoration','Hazard recognition, customer priorities, item classification, contamination, security, and special-item escalation before handling contents.',[
 'Contents may contain sharps, medications, chemicals, firearms, ammunition, pests, mold, sewage, soot, unstable stacks, or sensitive personal information.',
 'Employees do not open or remove restricted items outside company policy.',
 'Triage decisions are photographed and tied to the approved scope and customer authorization.'],45,12)
add('packout-planning','Pack-Out Planning & Customer Communication','Contents Restoration','Room sequencing, labor, boxes, vehicles, access, staging, customer priorities, valuables, exclusions, and pack-back expectations.',[
 'The plan preserves room-of-origin and item relationships.',
 'Customer-selected essentials and do-not-pack items are confirmed before packing.',
 'Scope, storage, cleaning, disposal recommendations, and limitations are communicated without promising coverage.'],45,12)
add('contents-inventory','Inventory, Photo Documentation & Barcoding','Contents Restoration','Creating a complete room-by-room inventory with unique identifiers, images, condition notes, disposition, and container tracking.',[
 'Each item or logical group is identifiable from the inventory and photos.',
 'Pre-existing damage and non-salvageable recommendations are documented before movement when practical.',
 'Barcode and container records must reconcile with room, vehicle, cleaning, storage, and pack-back locations.'],60,12)
add('packing-chain-custody','Packing, Handling & Chain of Custody','Contents Restoration','Selecting packing materials, protecting fragile items, sealing containers, movement logs, vehicle loading, and custody controls.',[
 'Packing method matches weight, fragility, contamination, moisture, and storage duration.',
 'Containers are not overloaded and are labeled with job, room, box, and handling information.',
 'Every custody transfer or storage move is traceable.'],55,12,basis='29 CFR 1910/1926 material-handling and PPE requirements; company procedure')
add('contents-cleaning-selection','Contents Cleaning Method Selection','Contents Restoration','Using material, soil, finish, value, contamination, manufacturer guidance, and test results to choose a cleaning method.',[
 'Start with the least aggressive effective method and test for colorfastness, finish, dimensional change, and residue.',
 'Cleaning chemistry follows labels, SDSs, dilution, PPE, ventilation, and disposal requirements.',
 'Items outside in-house capability are referred to an approved specialist.'],60,12,basis='29 CFR 1910.1200; PPE standards')
add('ultrasonic-awareness','Ultrasonic and Immersion Cleaning Awareness','Contents Restoration','Equipment, chemistry, basket loading, material limitations, cavitation, rinsing, drying, electrical, and operator-safety awareness.',[
 'Not every item or finish is compatible with immersion or ultrasonic energy.',
 'Machine settings, chemistry, temperature, and exposure time follow manufacturer and company procedures.',
 'Employees need hands-on authorization before operating specialty cleaning equipment.'],40,12,warning='Awareness course only unless accompanied by equipment-specific practical qualification.')
add('soft-contents-textiles','Soft Contents & Textile Handling','Contents Restoration','Triage, labeling, separation, odor/soil considerations, laundering/dry-cleaning referral, drying, and packaging for textiles and soft goods.',[
 'Material labels, dyes, finishes, contamination, shrinkage, and specialty value guide processing.',
 'Contaminated textiles are isolated from clean goods and handled with appropriate PPE.',
 'Processing and returned quantities reconcile with the original inventory.'],45,12)
add('electronics-specialty','Electronics, Art & Specialty Items','Contents Restoration','Safe stabilization and referral of electronics, appliances, artwork, musical instruments, documents, collectibles, and other sensitive property.',[
 'Do not energize wet, heat-damaged, contaminated, or fire-exposed electronics.',
 'High-value and specialty items require enhanced documentation and approved specialists.',
 'Custody, condition, handling, and referral decisions are recorded.'],45,12)
add('contents-drying','Contents Drying & Climate Control','Contents Restoration','Drying chambers, shelving, airflow, dehumidification, item spacing, material monitoring, and mold-prevention controls for contents.',[
 'Contents drying is monitored by material and environmental evidence rather than time alone.',
 'Airflow and heat must not damage finishes, adhesives, batteries, media, textiles, or sensitive items.',
 'Clean and contaminated drying operations are segregated.'],50,12)
add('warehouse-storage','Secure Storage & Warehouse Practices','Contents Restoration','Receiving, shelving, aisle clearance, stacking, environmental control, pest prevention, fire protection, access, and inventory audits.',[
 'Storage locations are recorded and updated immediately when items move.',
 'Heavy or unstable loads are stored to prevent collapse and manual-handling injuries.',
 'Access to customer property is limited and documented.'],50,12,roles=['contents','warehouse','project_manager'],basis='29 CFR 1910 walking-working surfaces, material handling, fire protection, and powered industrial truck standards as applicable')
add('packback-reconciliation','Pack-Back & Final Reconciliation','Contents Restoration','Return planning, room placement, box reconciliation, customer walkthrough, unresolved items, damage reporting, and final signatures.',[
 'Returned items are checked against the inventory and destination room.',
 'Missing, extra, damaged, or customer-rejected items are documented before closing the visit.',
 'Pack-back records preserve customer approvals and unresolved follow-up.'],45,12)

# Asbestos
asbwarn='Internal LMS training does not replace EPA-accredited training, Virginia licensing, project-specific competent-person oversight, medical surveillance, fit testing, air monitoring, or other legal prerequisites.'
add('asbestos-awareness','Asbestos Awareness & Suspect Materials','Asbestos','Recognition of common suspect building materials, health hazards, disturbance risks, warning signs, and employee stop-work duties.',[
 'Suspect materials include thermal-system insulation, surfacing material, flooring, mastics, roofing, cement products, joint compound, textures, and other legacy materials.',
 'Material cannot be declared asbestos-free by appearance, age, or customer statement alone.',
 'Employees avoid disturbance and notify supervision when the survey or material status is incomplete.'],120,12,roles=['all'],basis='29 CFR 1926.1101(k); Virginia VOSH asbestos requirements',warning=asbwarn,required=True)
add('pre-renovation-survey-pacm','Pre-Renovation Survey, PACM & Stop-Work','Asbestos','Building-owner/employer information duties, suspect material identification, presumed asbestos-containing material, survey review, and pre-disturbance decision points.',[
 'A thorough inspection or legally sufficient material determination is required before renovation or demolition may disturb suspect material.',
 'Thermal-system insulation and sprayed/troweled surfacing material are presumed asbestos-containing unless properly rebutted; certain flooring may also be presumed.',
 'Scope changes or hidden suspect material require renewed stop-work and review.'],60,12,basis='29 CFR 1926.1101(k); Virginia DOLI asbestos guidance',warning=asbwarn)
add('asbestos-classes','OSHA Construction Asbestos Classes I–IV','Asbestos','Awareness of OSHA Class I, II, III, and IV work and how classification affects training, competent-person, control, and work-practice requirements.',[
 'Class I concerns removal of thermal-system insulation and surfacing ACM/PACM; Class II concerns other ACM; Class III is repair/maintenance disturbance; Class IV is custodial contact or cleanup of dust/debris.',
 'The employer and competent person classify the work before disturbance.',
 'Employees perform only the class of work for which all training, licensing, and program prerequisites are satisfied.'],75,12,basis='29 CFR 1926.1101',warning=asbwarn)
add('asbestos-regulated-area','Asbestos Regulated Areas, Controls & PPE','Asbestos','Regulated-area setup, access restrictions, signs, wet methods, HEPA controls, isolation, protective clothing, hygiene, and prohibited practices.',[
 'Access is limited to authorized personnel and required signs or labels are posted.',
 'Wet methods, HEPA filtration, prompt cleanup, and class-specific controls are used unless a recognized exception applies.',
 'Dry sweeping, compressed air, and uncontrolled debris handling are prohibited.'],90,12,basis='29 CFR 1926.1101(e), (g), and (i)',warning=asbwarn)
add('asbestos-respiratory-medical','Asbestos Respiratory Protection & Medical Surveillance','Asbestos','How asbestos respiratory selection, medical evaluation, fit testing, exposure assessment, protective clothing, and medical surveillance interact.',[
 'Respirator use follows the written respiratory program and asbestos standard, including medical evaluation and fit testing before required use.',
 'Respirators are not used as a substitute for feasible engineering and work-practice controls.',
 'Medical surveillance depends on exposure and work conditions and is managed confidentially by qualified medical providers.'],75,12,basis='29 CFR 1926.1101(h), (i), and (m); 29 CFR 1910.134',warning=asbwarn)
add('asbestos-decon','Asbestos Decontamination & Hygiene','Asbestos','Class- and exposure-dependent decontamination areas, clean/dirty separation, respirator and clothing sequence, showers, waste routes, and hygiene restrictions.',[
 'Employees do not eat, drink, smoke, chew, or apply cosmetics in regulated areas.',
 'Contaminated clothing and equipment are removed and handled to prevent exposure outside the work area.',
 'The decontamination arrangement matches the class, quantity, exposure assessment, and applicable work plan.'],75,12,basis='29 CFR 1926.1101(j)',warning=asbwarn)
add('asbestos-waste','Asbestos Waste Packaging, Labeling & Disposal','Asbestos','Leak-tight packaging, wet waste, labels, exterior cleaning, temporary storage, transport documents, disposal facility coordination, and spill response.',[
 'Waste and contaminated debris are kept adequately wet and placed in leak-tight labeled containers as required.',
 'Containers are cleaned before leaving the regulated area and protected from damage.',
 'Waste shipment and disposal records are reconciled and retained.'],60,12,basis='29 CFR 1926.1101; EPA NESHAP and Virginia requirements as applicable',warning=asbwarn)
add('virginia-asbestos','Virginia Asbestos Licensing & Notification Awareness','Asbestos','Virginia-specific awareness of licensed contractor, supervisor, worker, inspector, project designer, notification, and accreditation requirements.',[
 'Virginia licensing and notification depend on material, friability, quantity, work class, facility type, and project conditions.',
 'Only properly licensed/accredited persons perform regulated functions that require those credentials.',
 'Project management verifies current requirements with Virginia DOLI and other authorities before mobilization.'],75,12,basis='Virginia Department of Professional and Occupational Regulation and Virginia DOLI requirements',warning=asbwarn)
add('trace-asbestos','Trace/Below-1% Asbestos Company Decision Process','Asbestos','Company decision-making for materials reported below one percent asbestos, including OSHA exposure duties, laboratory limitations, scope, controls, employee training, and legal review.',[
 'A below-one-percent laboratory result does not automatically remove every OSHA exposure, hazard communication, respiratory, waste, contract, or state-law consideration.',
 'The employer evaluates task, disturbance method, potential airborne exposure, other regulated constituents, and company policy before authorizing work.',
 'Technicians do not independently decide that trace asbestos is safe to disturb.'],75,12,basis='29 CFR 1926.1101 and 1926.21; site-specific legal and industrial hygiene review',warning=asbwarn)
add('asbestos-competent-person','Asbestos Competent Person & Supervisor Responsibilities','Asbestos','Pre-job inspection, work classification, control selection, regulated areas, monitoring, employee qualification, daily oversight, correction authority, and records.',[
 'The competent person can identify asbestos hazards, select controls, and has authority to take prompt corrective measures.',
 'Training level varies by class of work and may require EPA Model Accreditation Plan-equivalent supervisor training.',
 'Daily inspections and corrective actions are documented.'],120,12,roles=['asbestos','project_manager'],basis='29 CFR 1926.1101(o)',warning=asbwarn)
add('asbestos-records','Asbestos Project Records & Exposure Documentation','Asbestos','Exposure assessments, objective data, monitoring, medical surveillance, training, fit tests, competent-person inspections, waste, and employee access to records.',[
 'Records are complete, accurate, retrievable, and retained for the period required by the applicable standard.',
 'Employees receive access to exposure and medical records as required while medical confidentiality is protected.',
 'Project records identify the data, assumptions, controls, personnel, dates, and work represented.'],60,12,basis='29 CFR 1926.1101(n); 29 CFR 1910.1020',warning=asbwarn)

# OSHA and safety courses
add('osha-rights-responsibilities','OSHA Rights, Responsibilities & Safety Culture','OSHA & Safety','Employee rights, employer responsibilities, reporting without retaliation, inspections, safety rules, stop-work expectations, and participation in hazard correction.',[
 'Employees receive understandable instruction on hazards and applicable rules before performing assigned work.',
 'Hazards, injuries, symptoms, near misses, and damaged safeguards are reported promptly.',
 'Retaliation for exercising protected safety rights is prohibited.'],35,12,roles=['all'],basis='OSH Act; 29 CFR 1926.20-21; Virginia VOSH',required=True)
add('hazard-communication','Hazard Communication, GHS Labels & SDS','OSHA & Safety','Written program, chemical inventory, labels, pictograms, signal words, hazard statements, safety data sheets, non-routine tasks, and employee training.',[
 'Employees know how to obtain and use labels and SDSs during each work shift.',
 'Training covers workplace chemicals, detection methods, hazards, protective measures, and the written program.',
 'Secondary containers and mixtures follow company labeling and compatibility rules.'],60,0,roles=['all'],basis='29 CFR 1910.1200; 29 CFR 1926.59',required=True)
add('ppe-hazard-assessment','PPE Hazard Assessment, Selection & Use','OSHA & Safety','Hazard assessment, eye/face, hand, body, head, foot, hearing, and respiratory PPE selection, limitations, inspection, use, care, and retraining.',[
 'PPE is selected from the hazard assessment and fits the employee and task.',
 'Employees demonstrate when PPE is needed, what is needed, how to wear it, its limitations, and care/disposal.',
 'Damaged or contaminated PPE is removed from service.'],60,0,roles=['all'],basis='29 CFR 1910.132-138; 29 CFR 1926 Subpart E',required=True)
add('bloodborne-pathogens','Bloodborne Pathogens & Exposure Control','OSHA & Safety','Occupational exposure determination, universal precautions, engineering/work-practice controls, PPE, sharps, housekeeping, hepatitis B vaccination, post-exposure response, and annual training.',[
 'The standard applies when occupational exposure to blood or other potentially infectious materials is reasonably anticipated.',
 'Employees use universal precautions and do not pick up potentially contaminated broken glass by hand.',
 'Exposure incidents are washed, reported, medically evaluated, and documented immediately under the exposure-control plan.'],90,12,roles=['water','fire','mold','contents','asbestos','project_manager'],basis='29 CFR 1910.1030')
add('electrical-gfci','Electrical Safety, GFCI & Temporary Power','OSHA & Safety','Energized-condition recognition, wet environments, GFCI use, cords, panels, generators, temporary wiring, qualified-person limits, and damaged equipment.',[
 'Water and conductive contamination increase shock and electrocution risk.',
 'Cords, plugs, devices, GFCIs, panels, and grounding are inspected and protected from damage.',
 'Only qualified persons perform work on or near exposed energized parts.'],60,12,roles=['all'],basis='29 CFR 1926 Subpart K; 29 CFR 1910 Subpart S',required=True)
add('lockout-tagout','Control of Hazardous Energy / Lockout-Tagout','OSHA & Safety','Authorized, affected, and other employee roles; energy isolation; stored energy; verification; group procedures; shift changes; and contractor coordination.',[
 'Turning a control switch off is not energy isolation.',
 'Authorized employees follow the machine-specific energy-control procedure and verify isolation before work.',
 'Locks or tags are removed only under the approved procedure.'],75,0,roles=['project_manager','warehouse','water','fire'],basis='29 CFR 1910.147; construction equipment-specific standards as applicable')
add('fall-protection','Fall Protection for Restoration Work','OSHA & Safety','Fall-hazard recognition, guardrails, personal fall arrest, warning lines, holes, roofs, leading edges, training certification, rescue considerations, and retraining.',[
 'Employees exposed to fall hazards receive training from a competent person before exposure.',
 'Systems are selected, inspected, anchored, used, and stored under the applicable plan and manufacturer instructions.',
 'Training certification identifies the employee, date, and trainer/employer.'],75,0,roles=['water','fire','mold','asbestos','project_manager'],basis='29 CFR 1926 Subpart M; 1926.503')
add('ladder-safety','Ladder & Stairway Safety','OSHA & Safety','Selection, duty rating, inspection, setup, access, angle, three-point contact, electrical hazards, prohibited use, and retraining.',[
 'Employees are trained to recognize ladder and stairway hazards and minimize them.',
 'Ladders are inspected before use, set on stable surfaces, secured as needed, and used within load and manufacturer limits.',
 'Employees face the ladder and maintain a handhold; loads must not cause loss of balance.'],55,0,roles=['all'],basis='29 CFR 1926 Subpart X; 1926.1060',required=True)
add('scaffold-platform','Scaffold & Mobile Platform Safety','OSHA & Safety','Supported and mobile scaffold awareness, competent-person inspection, access, fall protection, planking, loading, movement, electrical clearance, and training.',[
 'Scaffolds are erected, moved, altered, and dismantled only under qualified/competent supervision as required.',
 'Users inspect the platform and follow access, loading, fall-protection, and clearance requirements.',
 'Employees do not ride mobile scaffolds unless all applicable conditions are met.'],60,0,basis='29 CFR 1926 Subpart L; 1926.454')
add('silica-control','Respirable Crystalline Silica Exposure Control','OSHA & Safety','Tasks that generate silica, Table 1 awareness, engineering controls, respirators, written exposure-control plan, housekeeping, competent person, medical surveillance, and training.',[
 'Cutting, grinding, drilling, or demolishing concrete, mortar, masonry, tile, or similar materials may generate respirable silica.',
 'Use specified wet methods or dust collection and follow the written exposure-control plan.',
 'Dry sweeping and compressed air are restricted when they can contribute to exposure.'],90,0,roles=['water','fire','mold','asbestos','project_manager'],basis='29 CFR 1926.1153')
add('lead-construction','Lead in Construction Awareness','OSHA & Safety','Lead-containing coatings/materials, demolition and renovation triggers, initial protections, exposure assessment, regulated areas, hygiene, respirators, medical surveillance, and training.',[
 'Construction lead rules can apply to demolition, renovation, cleanup, painting, and material handling where lead is present.',
 'Certain trigger tasks require interim protection until exposure is assessed.',
 'Employees do not disturb suspect lead-containing coatings without the approved plan and required controls.'],90,12,roles=['water','fire','mold','asbestos','project_manager'],basis='29 CFR 1926.62; EPA RRP requirements may also apply')
add('confined-spaces','Confined Spaces in Construction','OSHA & Safety','Identification, permit-space hazards, controlling contractor coordination, entry roles, isolation, atmospheric testing, rescue, training, and records.',[
 'Employees do not enter a confined space until it has been evaluated and the applicable entry procedure is authorized.',
 'Training is provided before assignment and when duties, hazards, procedures, or performance deficiencies change.',
 'Unauthorized rescue attempts can create additional victims.'],90,0,roles=['water','project_manager'],basis='29 CFR 1926 Subpart AA; 1926.1207')
add('hearing-conservation','Hearing Conservation & Noise','OSHA & Safety','Noise hazard recognition, controls, hearing protection, fit, communication, audiometric program awareness, and high-noise equipment.',[
 'Engineering and administrative controls are considered before relying only on hearing protectors.',
 'Hearing protection must be suitable, fitted, worn, maintained, and compatible with other PPE.',
 'Noise symptoms, communication failures, and damaged protectors are reported.'],55,12,roles=['all'],basis='29 CFR 1910.95; 29 CFR 1926.52 and 1926.101')
add('hand-power-tools','Hand & Power Tool Safety','OSHA & Safety','Tool selection, guarding, cords, switches, bits/blades, kickback, dust, vibration, inspection, maintenance, and qualified-person limits.',[
 'Use the right tool, accessory, guard, and rated speed for the task.',
 'Disconnect or isolate energy before adjustments, clearing jams, or changing accessories.',
 'Damaged tools are tagged and removed from service.'],60,12,roles=['all'],basis='29 CFR 1926 Subpart I; 29 CFR 1910 Subpart P')
add('abrasive-wheels','Abrasive Wheels & Machine Guarding','OSHA & Safety','Ring tests, wheel compatibility, RPM ratings, guards, tool rests, side loading, sparks, dust, and inspection for grinders and abrasive tools.',[
 'Wheel type and maximum speed must be compatible with the tool and task.',
 'Required guards and handles remain installed and correctly positioned.',
 'Cracked, dropped, expired, or incompatible wheels are not used.'],45,12,roles=['water','fire','mold','asbestos','warehouse'],basis='29 CFR 1910.212 and 1910.215; 29 CFR 1926.300-303')
add('slips-trips-housekeeping','Walking-Working Surfaces, Slips, Trips & Housekeeping','OSHA & Safety','Wet floors, cords, hoses, debris, openings, lighting, stairs, access paths, stacking, and continuous housekeeping.',[
 'Work areas, passageways, stairs, and exits are kept clear and as dry as feasible.',
 'Cords and hoses are routed or protected to reduce trip and damage hazards.',
 'Openings, weak surfaces, and elevation changes are guarded or clearly controlled.'],45,12,roles=['all'],basis='29 CFR 1910 Subpart D; 29 CFR 1926.25 and related subparts',required=True)
add('emergency-action','Emergency Action & Fire Prevention Plans','OSHA & Safety','Alarm/reporting procedures, evacuation, accountability, critical operations, rescue/medical duties, contacts, fire hazards, ignition control, and employee review.',[
 'Employees know how to report an emergency, evacuate, assemble, and account for personnel.',
 'Plans are reviewed when developed, when duties change, and when the plan changes.',
 'Employees do not re-enter or perform rescue outside training and authorization.'],55,12,roles=['all'],basis='29 CFR 1910.38-39; 29 CFR 1926.35',required=True)
add('fire-extinguisher','Portable Fire Extinguisher Use','OSHA & Safety','Incipient-stage fire limits, extinguisher classes, selection, PASS technique, escape route, inspection, and evacuation-only policies.',[
 'Employees attempt extinguisher use only when company policy permits, the fire is incipient, the correct extinguisher is available, and a safe exit remains.',
 'Training and education are provided when extinguishers are available for employee use.',
 'Evacuation is the correct choice when the fire, smoke, fuel, or conditions exceed training.'],45,12,roles=['all'],basis='29 CFR 1910.157(g); 29 CFR 1926 Subpart F')
add('first-aid-awareness','First Aid, CPR & AED Awareness','OSHA & Safety','Emergency activation, scene safety, bleeding, shock, burns, electrical injury, chemical exposure, heat illness, CPR/AED roles, and first-aid supply access.',[
 'Call emergency services early and protect rescuers from electrical, structural, traffic, chemical, and biological hazards.',
 'Only trained employees provide care within their certification and company plan.',
 'First-aid incidents and occupational exposures are reported and documented.'],60,24,roles=['all'],basis='29 CFR 1926.50; 29 CFR 1910.151',warning='Awareness content does not replace hands-on first aid/CPR/AED certification when a valid certificate is required.')
add('heat-illness','Heat Illness Prevention','OSHA & Safety','Heat hazard recognition, hydration, acclimatization, workload, PPE burden, breaks, buddy monitoring, symptoms, emergency response, and current Virginia rulemaking awareness.',[
 'Heat risk can occur indoors or outdoors and can be increased by protective clothing and restoration equipment.',
 'Employees report symptoms early, cool the person, and activate emergency response for suspected heat stroke.',
 'Virginia is developing a heat illness prevention standard; company procedures must be reviewed as the rule develops.'],50,12,roles=['all'],basis='OSH Act General Duty Clause; OSHA heat guidance and rulemaking; Virginia Code § 40.1-44.2 rulemaking',required=True)
add('cold-weather','Cold Stress & Severe Weather','OSHA & Safety','Wind chill, wet clothing, hypothermia, frostbite, ice, storms, lightning, vehicle exposure, warming, work/rest planning, and emergency response.',[
 'Wet clothing and wind can rapidly increase cold stress.',
 'Employees use layering, dry changes, warm breaks, buddy monitoring, and weather-aware scheduling.',
 'Confusion, loss of coordination, slurred speech, or uncontrolled shivering requires immediate action.'],40,12,roles=['all'],basis='29 CFR 1926.21 and OSHA guidance')
add('ergonomics-material-handling','Ergonomics & Material Handling','OSHA & Safety','Lift planning, team lifts, carts, stair carries, awkward postures, repetitive work, box weights, fatigue, and early symptom reporting.',[
 'Plan the route and load before lifting; use mechanical assistance or team lifting when needed.',
 'Keep loads close, avoid twisting, and reposition work to reduce force and awkward posture.',
 'Early discomfort and overexertion hazards are reported before a serious injury occurs.'],45,12,roles=['all'],basis='OSH Act General Duty Clause; 29 CFR 1926.21 and material-handling standards',required=True)
add('forklift-awareness','Powered Industrial Trucks / Forklift Operator Safety','OSHA & Safety','Operator training/evaluation, truck inspection, load handling, pedestrians, docks, ramps, charging/fueling, attachments, and three-year evaluation.',[
 'Only trained and evaluated operators use powered industrial trucks.',
 'Operators inspect the truck before service and remove unsafe equipment from use.',
 'Refresher training is triggered by unsafe operation, incidents, evaluations, workplace changes, or different truck types.'],120,36,roles=['warehouse','project_manager'],basis='29 CFR 1910.178(l)',warning='Operator qualification requires formal instruction, practical training, and workplace evaluation—not online training alone.')
add('aerial-lift','Aerial Lift & Mobile Elevating Work Platform Safety','OSHA & Safety','Operator authorization, pre-use inspection, fall protection, setup, tip-over, traffic, overhead electrical hazards, rescue, and manufacturer limits.',[
 'Only trained and authorized operators use the specific equipment category.',
 'The lift is inspected and set up on suitable ground with required fall protection and exclusion zones.',
 'Employees maintain clearance from power lines and follow the emergency-lowering plan.'],90,0,roles=['project_manager','fire','water'],basis='29 CFR 1926.453; manufacturer and consensus-standard requirements',warning='Practical, equipment-specific operator evaluation is required.')
add('hazwoper-awareness','HAZWOPER Awareness & Emergency Spill Response','OSHA & Safety','How to recognize a hazardous-substance release, isolate, notify, avoid unauthorized response, and understand awareness/operations/technician role boundaries.',[
 'Employees at awareness level recognize and report releases but do not take actions beyond their training and assigned role.',
 'Unknown chemicals, drums, reactions, vapor clouds, oxygen deficiency, or uncontrolled releases require emergency isolation and specialist response.',
 'HAZWOPER applicability and training level are determined by the employer based on the operation and expected duties.'],60,12,roles=['water','fire','mold','project_manager'],basis='29 CFR 1910.120; 29 CFR 1926.65',warning='This awareness course does not satisfy 8-, 24-, or 40-hour HAZWOPER role training.')
add('chemical-products','Disinfectants, Solvents & Odor-Control Chemical Safety','OSHA & Safety','SDS review, dilution, ventilation, incompatibilities, skin/eye exposure, respirators, flammability, application equipment, re-entry, and disposal.',[
 'Use only approved products for the labeled purpose, dilution, surface, and application method.',
 'Never mix products unless the manufacturer and company procedure expressly allow it.',
 'Respirator cartridge selection cannot be based on odor or container color alone.'],60,12,roles=['water','fire','mold','contents','asbestos'],basis='29 CFR 1910.1200; PPE and respiratory protection standards')
add('compressed-gases','Compressed Gas & Cylinder Safety','OSHA & Safety','Cylinder identification, caps, securing, transport, regulators, separation, leaks, fire, oxygen enrichment, and damaged-cylinder response.',[
 'Cylinders are identified, upright or otherwise properly secured, capped when required, and protected from impact and heat.',
 'Only compatible regulators and fittings are used; oil or grease is kept away from oxygen equipment.',
 'A damaged, leaking, unknown, or fire-exposed cylinder is isolated and referred to emergency or supplier personnel.'],45,12,roles=['fire','warehouse','project_manager'],basis='29 CFR 1910.101 and 1910.253; 29 CFR 1926 Subpart J')
add('incident-reporting','Incident, Injury, Near-Miss & OSHA Recordkeeping Awareness','OSHA & Safety','Immediate reporting, medical response, evidence preservation, supervisor investigation, corrective action, employee rights, and OSHA recordkeeping/reporting roles.',[
 'All injuries, illnesses, exposures, vehicle incidents, property damage, and near misses are reported promptly under company policy.',
 'Supervisors preserve facts and correct hazards without assigning blame or discouraging reporting.',
 'Only designated administrators make OSHA recordability and government-reporting determinations.'],50,12,roles=['all'],basis='29 CFR Part 1904; 29 CFR 1926.22; Virginia VOSH reporting requirements',required=True)
add('sanitation-hygiene','Jobsite Sanitation, Hygiene & Decontamination','OSHA & Safety','Potable water, toilets, handwashing, eating restrictions, contaminated clothing, pest hazards, clean areas, and employee hygiene.',[
 'Employees have access to potable water, sanitation, and handwashing appropriate to the work.',
 'Food, drink, tobacco, cosmetics, and contact-lens handling are kept out of contaminated work areas.',
 'Contaminated clothing and PPE are removed and handled without spreading hazards.'],40,12,roles=['all'],basis='29 CFR 1926.51; substance-specific standards',required=True)
add('demolition-safety','Demolition Safety & Structural Hazards','OSHA & Safety','Engineering survey awareness, utilities, collapse zones, floor/wall openings, debris removal, shoring, sequencing, and selective demolition controls.',[
 'An engineering survey by a competent person is required before demolition operations begin where the standard applies.',
 'Utilities and hidden hazards are located or controlled before cutting or removal.',
 'Employees stay out of uncontrolled collapse areas and do not alter structural members outside the approved plan.'],75,0,roles=['water','fire','mold','asbestos','project_manager'],basis='29 CFR 1926 Subpart T')
add('fleet-defensive-driving','Fleet & Defensive Driving','OSHA & Safety','Vehicle inspection, seat belts, distraction, backing, following distance, weather, fatigue, parking, load securement, crashes, and company authorization.',[
 'Drivers inspect the vehicle and secure tools, chemicals, equipment, and customer property before travel.',
 'Seat belts are used and handheld-device distraction is prohibited under company policy and applicable law.',
 'Backing uses planning, cameras, spotters, and a stop-if-uncertain rule.'],60,12,roles=['all'],basis='Company fleet program; applicable motor vehicle laws',required=True)
add('chainsaw-debris','Chainsaw & Storm Debris Removal Awareness','OSHA & Safety','Kickback, chain brake, PPE, compression/tension, hung limbs, electrical lines, unstable trees, fueling, exclusion zones, and qualified-worker limits.',[
 'Chainsaw and tree work is performed only by trained, equipped, and authorized employees.',
 'Downed electrical lines and trees contacting lines are treated as energized and referred to the utility/qualified responders.',
 'Bystanders remain outside the cutting and falling zone.'],60,12,roles=['water','fire','project_manager'],basis='OSHA cleanup guidance; 29 CFR 1910.266 concepts; manufacturer instructions',warning='Awareness course only; hands-on saw qualification and task-specific supervision are required.')
add('generator-co','Portable Generators & Carbon Monoxide','OSHA & Safety','Generator placement, ventilation, CO poisoning, refueling, grounding/GFCI, cords, weather protection, load, and emergency symptoms.',[
 'Portable generators are never operated inside homes, garages, or enclosed spaces where exhaust can accumulate.',
 'CO cannot be detected reliably by smell; symptoms require immediate fresh air and emergency response.',
 'Cords, GFCI protection, fuel handling, and generator loading are checked.'],45,12,roles=['water','fire','project_manager'],basis='OSHA cleanup and generator safety guidance; 29 CFR 1926 Subpart K')
add('violence-lone-worker','Workplace Violence, Customer Conflict & Lone-Worker Safety','OSHA & Safety','Threat recognition, check-in procedures, de-escalation, pets, weapons, domestic disputes, criminal activity, privacy, withdrawal, and emergency contact.',[
 'Employees leave and call for help when violence, weapons, criminal activity, unsafe occupants, or escalating threats are present.',
 'Lone-worker check-in and location procedures are followed on after-hours or isolated jobs.',
 'Employees do not physically intervene beyond their training or block their own exit.'],45,12,roles=['all'],basis='OSH Act General Duty Clause; company safety program')
add('respiratory-program-admin','Respiratory Protection Program Administrator','Leadership & Compliance','Administrator duties for hazard evaluation, respirator selection, medical evaluation, fit testing, training, maintenance, cartridge schedules, records, and program evaluation.',[
 'The administrator coordinates a written, worksite-specific program whenever respirators are required.',
 'Medical evaluations precede fit testing or required use, and tight-fitting users are fit tested before use and at least annually.',
 'Program effectiveness and workplace conditions are evaluated and corrected.'],150,12,roles=['project_manager','admin'],basis='29 CFR 1910.134; 29 CFR 1926.103',warning='Administrator designation requires appropriate knowledge and authority; this course supports but does not independently establish competence.')
add('osha-recordkeeping-admin','OSHA Recordkeeping & Regulatory Reporting for Administrators','Leadership & Compliance','Recordability, work-relatedness, forms 300/301/300A, privacy cases, annual posting, retention, severe-injury reporting, and Virginia VOSH coordination.',[
 'Recordability and compensability are different determinations.',
 'Fatalities, in-patient hospitalizations, amputations, and losses of an eye have time-sensitive reporting rules.',
 'Records are protected, retained, certified, posted, and provided as required.'],120,12,roles=['admin','project_manager'],basis='29 CFR Part 1904; Virginia VOSH')
add('training-matrix-admin','Training Matrix, Competency & Authorization Management','Leadership & Compliance','Assigning hazard-based training, verifying hands-on competency, managing expirations, documenting retraining triggers, and separating course completion from work authorization.',[
 'Training is assigned from job tasks, exposures, equipment, programs, and legal prerequisites—not title alone.',
 'Online knowledge training is paired with practical evaluation when a standard or task requires demonstrated skill.',
 'Expired, incomplete, or superseded qualifications are removed from authorization lists.'],90,12,roles=['admin','project_manager'],basis='29 CFR 1926.21 and substance/equipment-specific training standards')
add('job-hazard-analysis','Job Hazard Analysis & Daily Safety Briefing','Leadership & Compliance','Breaking work into steps, identifying hazards, selecting controls, assigning responsibilities, briefing crews, and updating the analysis when conditions change.',[
 'The analysis reflects the actual site, task, crew, tools, substances, occupants, and weather.',
 'Controls and stop-work triggers are understood before production begins.',
 'Changed conditions are added to the record and communicated to affected employees.'],75,12,roles=['project_manager','water','fire','mold','contents','asbestos'],basis='29 CFR 1926.20-21; company safety program')

# Quality/compliance administration
add('certificate-records','Training Certificates, Expiration & Record Retention','Leadership & Compliance','Internal certificate controls, unique identifiers, completion evidence, expiration logic, retraining, superseded records, privacy, and audits.',[
 'A certificate is issued only after all required course and competency elements are satisfied.',
 'The LMS distinguishes internal completion from outside licenses, medical records, fit tests, and accredited credentials.',
 'Administrators retain the latest and historical records based on the applicable program and legal schedule.'],60,12,roles=['admin','project_manager'])

OUT.write_text(json.dumps({'reviewedOn':review,'courses':courses},indent=2),encoding='utf-8')
print(f'wrote {len(courses)} courses to {OUT}')
from collections import Counter
print(Counter(c['category'] for c in courses))
