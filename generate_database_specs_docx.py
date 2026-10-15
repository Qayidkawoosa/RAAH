import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, hex_color):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_database_specs_document():
    doc = Document()

    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)

    COLOR_PRIMARY = RGBColor(30, 58, 138)    # Deep Navy #1E3A8A
    COLOR_SECONDARY = RGBColor(15, 118, 110) # Teal #0F766E
    COLOR_ACCENT = RGBColor(225, 29, 72)     # Rose #E11D48
    COLOR_DARK = RGBColor(30, 41, 59)        # Slate Dark #1E293B
    COLOR_MUTED = RGBColor(100, 116, 139)    # Muted Slate #64748B

    # Document Header
    p_badge = doc.add_paragraph()
    r_badge = p_badge.add_run("RAASTA KASHMIR · PHASE 2 ENGINEERING SPECIFICATION")
    r_badge.font.name = "Arial"
    r_badge.font.size = Pt(8.5)
    r_badge.font.bold = True
    r_badge.font.color.rgb = COLOR_SECONDARY

    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(2)
    title_p.paragraph_format.space_after = Pt(4)
    r_title = title_p.add_run("PostgreSQL Database Architecture & Schema Specification")
    r_title.font.name = "Arial"
    r_title.font.size = Pt(22)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_PRIMARY

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_after = Pt(14)
    r_sub = sub_p.add_run("Multi-Tenant School Hierarchy, Entity Relations, Field Dictionary & Telemetry Data Flow")
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(11)
    r_sub.font.color.rgb = COLOR_MUTED

    # Section 1: Executive Architecture Overview
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(10)
    h1.paragraph_format.space_after = Pt(4)
    r_h1 = h1.add_run("1. Executive Architecture Overview")
    r_h1.font.name = "Arial"
    r_h1.font.size = Pt(14)
    r_h1.font.bold = True
    r_h1.font.color.rgb = COLOR_PRIMARY

    p_intro = doc.add_paragraph()
    p_intro.paragraph_format.space_after = Pt(8)
    r_intro = p_intro.add_run(
        "Raasta Kashmir's Phase 2 backend is built upon a multi-tenant relational architecture designed for high-concurrency real-time GPS tracking and on-device AI Driver Monitoring System (DMS) incident auditing. "
        "The relational hierarchy flows strictly from top-level educational institutions down to physical vehicles, operational routes, enrolled students, active driving trips, and safety violations."
    )
    r_intro.font.name = "Arial"
    r_intro.font.size = Pt(9.5)
    r_intro.font.color.rgb = COLOR_DARK

    # The Hierarchy Flow Callout
    p_flow = doc.add_paragraph()
    p_flow.paragraph_format.space_before = Pt(4)
    p_flow.paragraph_format.space_after = Pt(12)
    r_flow_label = p_flow.add_run("The Relational Hierarchy: ")
    r_flow_label.font.bold = True
    r_flow_label.font.size = Pt(10)
    r_flow_label.font.color.rgb = COLOR_SECONDARY
    r_flow = p_flow.add_run("School  ⟶  Buses  ⟶  Drivers & Routes  ⟶  Trips  ⟶  Students  ⟶  Parents  ⟶  DMS Incidents")
    r_flow.font.size = Pt(10)
    r_flow.font.bold = True
    r_flow.font.color.rgb = COLOR_PRIMARY

    # Section 2: Master Summary Table
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(10)
    h2.paragraph_format.space_after = Pt(6)
    r_h2 = h2.add_run("2. Master Database Entity Summary")
    r_h2.font.name = "Arial"
    r_h2.font.size = Pt(14)
    r_h2.font.bold = True
    r_h2.font.color.rgb = COLOR_PRIMARY

    summary_table = doc.add_table(rows=9, cols=5)
    summary_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    summary_table.autofit = False

    col_widths = [Inches(1.2), Inches(1.8), Inches(1.0), Inches(1.3), Inches(1.5)]
    for row in summary_table.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = width

    headers = ["Table Name", "Real-World Purpose", "Primary Key", "Foreign Keys", "Key Relations"]
    hdr_row = summary_table.rows[0]
    for idx, text in enumerate(headers):
        cell = hdr_row.cells[idx]
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(text)
        r.font.name = "Arial"
        r.font.size = Pt(8.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    entities_data = [
        ("schools", "Educational institutions (KVS, Burn Hall)", "id (CUID)", "None (Root)", "Buses[], Users[], Routes[]"),
        ("users", "Accounts with RBAC (Driver, Parent, Admin, RTO)", "id (CUID)", "schoolId", "AssignedBus, Trips[], Students[]"),
        ("buses", "Physical school transport vehicles", "id (CUID)", "schoolId, driverId, routeId", "School, Driver, Route, Trips[], Students[]"),
        ("routes", "Designated transit paths across Srinagar", "id (CUID)", "schoolId", "Buses[], RouteStops[]"),
        ("route_stops", "Boarding stops with GPS coords (Nishat, etc.)", "id (CUID)", "routeId", "Route, Students[]"),
        ("students", "Enrolled children riding the transport", "id (CUID)", "parentId, busId, stopId", "Parent, Bus, RouteStop"),
        ("trips", "Active bus journey sessions from start to school", "id (CUID)", "busId, driverId", "Bus, Driver, DmsIncidents[]"),
        ("dms_incidents", "AI camera safety violation audit logs", "id (CUID)", "tripId", "Trip")
    ]

    for row_idx, data in enumerate(entities_data, start=1):
        row = summary_table.rows[row_idx]
        bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, text in enumerate(data):
            cell = row.cells[col_idx]
            set_cell_background(cell, bg_color)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx in [0, 2] else WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(text)
            r.font.name = "Arial"
            r.font.size = Pt(8)
            r.font.bold = True if col_idx == 0 else False
            r.font.color.rgb = COLOR_PRIMARY if col_idx == 0 else COLOR_DARK

    # Section 3: Deep Dive into Every Table
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(16)
    h3.paragraph_format.space_after = Pt(6)
    r_h3 = h3.add_run("3. Detailed Table Specifications & Field Dictionary")
    r_h3.font.name = "Arial"
    r_h3.font.size = Pt(14)
    r_h3.font.bold = True
    r_h3.font.color.rgb = COLOR_PRIMARY

    tables_detail = [
        ("Table 1: schools (The Root Tenant)", "Represents educational organizations. Enforces multi-tenant data isolation so one school cannot view another school's vehicles.", [
            ("id", "String (CUID)", "Primary Key. Unique identifier, e.g., 'sch_kvs'"),
            ("name", "String", "Official school name (e.g. 'Kashmir Valley School')"),
            ("address", "String", "Physical campus address in Srinagar (e.g. 'Hazratbal, Srinagar')"),
            ("contactEmail", "String (Unique)", "Administrative email for incident summaries and alerts"),
            ("contactPhone", "String (Optional)", "Transport desk phone number"),
            ("createdAt", "DateTime", "Record creation timestamp (default: now())")
        ]),
        ("Table 2: buses (Fleet Transport)", "Represents physical school buses. Tracks registration, driver assignment, capacity, and active route.", [
            ("id", "String (CUID)", "Primary Key. Unique bus identifier"),
            ("busNo", "String (Unique)", "Official registration plate (e.g. 'JK-01-A-1234')"),
            ("capacity", "Int", "Total seated student capacity (default: 32)"),
            ("schoolId", "String (FK)", "Foreign Key referencing schools.id (Tenant ownership)"),
            ("driverId", "String (FK, Optional)", "Foreign Key referencing users.id (Active assigned driver)"),
            ("routeId", "String (FK, Optional)", "Foreign Key referencing routes.id (Designated transit path)"),
            ("registrationStatus", "String", "Compliance status ('Compliant', 'Fitness Due', 'Inspected')")
        ]),
        ("Table 3: users (Accounts & Roles)", "Stores credentials and profiles for all human actors in the system, governed by Role-Based Access Control (RBAC).", [
            ("id", "String (CUID)", "Primary Key. Unique user identifier"),
            ("email", "String (Unique)", "Login email address"),
            ("passwordHash", "String", "Cryptographic password hash generated via bcryptjs (salt rounds: 10)"),
            ("name", "String", "Full legal name (e.g. 'Jehangir Dar', 'Mrs. Kausar')"),
            ("phone", "String (Optional)", "Mobile number for automated SMS/push alerts"),
            ("role", "Enum (UserRole)", "One of: DRIVER, PARENT, SCHOOL_ADMIN, RTO"),
            ("schoolId", "String (FK, Optional)", "Foreign Key referencing schools.id")
        ]),
        ("Table 4 & 5: routes and route_stops (Geography & Waypoints)", "Stores master route polylines and physical passenger pickup/drop-off stops along Dal Lake and Srinagar.", [
            ("routes.id", "String (CUID)", "Primary Key. Master route identifier"),
            ("routes.name", "String", "Descriptive route title (e.g. 'Lal Chowk to Kashmir Valley School')"),
            ("routes.schoolId", "String (FK)", "Foreign Key referencing schools.id"),
            ("route_stops.id", "String (CUID)", "Primary Key. Stop identifier"),
            ("route_stops.name", "String", "Stop name (e.g. 'Nishat Stop', 'Shalimar Stop')"),
            ("route_stops.latitude", "Float", "Exact geographic WGS84 latitude coordinate (e.g. 34.1204)"),
            ("route_stops.longitude", "Float", "Exact geographic WGS84 longitude coordinate (e.g. 74.8451)"),
            ("route_stops.stopOrder", "Int", "Sequential order along the route (1, 2, 3...)")
        ]),
        ("Table 6: students (Children & Passenger Manifest)", "Models student passengers riding the bus. Bridges the relationship between Parents, Buses, and Stops.", [
            ("id", "String (CUID)", "Primary Key. Student identifier"),
            ("name", "String", "Student's full name (e.g. 'Arman Dar')"),
            ("className", "String", "Academic grade/section (e.g. 'Class 5-B')"),
            ("inviteCode", "String (Unique)", "Secret 6-character code used by parents during signup to link student"),
            ("parentId", "String (FK, Optional)", "Foreign Key referencing users.id (Parent account)"),
            ("busId", "String (FK, Optional)", "Foreign Key referencing buses.id (Assigned transport)"),
            ("stopId", "String (FK, Optional)", "Foreign Key referencing route_stops.id (Pickup location)"),
            ("status", "String", "Live status: 'at_home' | 'in_transit' | 'dropped'")
        ]),
        ("Table 7: trips (Active Journey Sessions)", "Logs every individual driving trip. Created when driver taps 'Start Trip', finalized when bus reaches the school.", [
            ("id", "String (CUID)", "Primary Key. Journey identifier"),
            ("busId", "String (FK)", "Foreign Key referencing buses.id"),
            ("driverId", "String (FK)", "Foreign Key referencing users.id"),
            ("status", "Enum (TripStatus)", "ACTIVE, COMPLETED, SOS_ALERT, DELAYED"),
            ("startedAt", "DateTime", "Exact timestamp when trip started"),
            ("endedAt", "DateTime (Optional)", "Exact timestamp when trip completed at school"),
            ("distanceKm", "Float", "Total cumulative kilometers covered during the trip"),
            ("maxSpeedKmh", "Float", "Maximum peak vehicle speed recorded (e.g. 48.2 km/h)"),
            ("safetyScore", "Int", "Driver performance score (0-100, initialized at 100)")
        ]),
        ("Table 8: dms_incidents (AI Safety Audit Log)", "The permanent audit ledger of all safety violations detected by the on-device AI camera during driving.", [
            ("id", "String (CUID)", "Primary Key. Violation incident identifier"),
            ("tripId", "String (FK)", "Foreign Key referencing trips.id (OnDelete: Cascade)"),
            ("violationType", "Enum (DmsViolationType)", "DROWSINESS, PHONE_DISTRACTION, NO_SEATBELT, HEAD_POSE, FATIGUE_YAWN"),
            ("severity", "Enum (IncidentSeverity)", "LOW, MEDIUM, HIGH, CRITICAL"),
            ("confidence", "Float", "AI model detection certainty (e.g. 0.94 = 94% certainty)"),
            ("latitude / longitude", "Float (Optional)", "Exact vehicle coordinates where violation occurred"),
            ("speedKmh", "Float (Optional)", "Vehicle speed at the exact moment of incident"),
            ("snapshotUrl", "String (Optional)", "Cloud storage URL to compressed photographic evidence"),
            ("timestamp", "DateTime", "Exact millisecond when incident occurred (default: now())")
        ])
    ]

    for title, desc, fields in tables_detail:
        th = doc.add_paragraph()
        th.paragraph_format.space_before = Pt(12)
        th.paragraph_format.space_after = Pt(2)
        r_th = th.add_run(title)
        r_th.font.name = "Arial"
        r_th.font.size = Pt(12)
        r_th.font.bold = True
        r_th.font.color.rgb = COLOR_SECONDARY

        pd = doc.add_paragraph()
        pd.paragraph_format.space_after = Pt(4)
        r_pd = pd.add_run(desc)
        r_pd.font.name = "Arial"
        r_pd.font.size = Pt(9)
        r_pd.font.italic = True
        r_pd.font.color.rgb = COLOR_MUTED

        f_table = doc.add_table(rows=len(fields) + 1, cols=3)
        f_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        f_table.autofit = False

        f_widths = [Inches(1.8), Inches(1.8), Inches(3.2)]
        for r in f_table.rows:
            for idx, w in enumerate(f_widths):
                r.cells[idx].width = w

        f_hdr = f_table.rows[0]
        for idx, text in enumerate(["Field Name", "Data Type", "Description & Constraints"]):
            cell = f_hdr.cells[idx]
            set_cell_background(cell, "334155")
            set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.name = "Arial"
            r.font.size = Pt(8)
            r.font.bold = True
            r.font.color.rgb = RGBColor(255, 255, 255)

        for f_idx, (f_name, f_type, f_desc) in enumerate(fields, start=1):
            row = f_table.rows[f_idx]
            bg = "F8FAFC" if f_idx % 2 == 1 else "FFFFFF"
            for c_idx, val in enumerate([f_name, f_type, f_desc]):
                cell = row.cells[c_idx]
                set_cell_background(cell, bg)
                set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
                p = cell.paragraphs[0]
                r = p.add_run(val)
                r.font.name = "Arial"
                r.font.size = Pt(8)
                if c_idx == 0:
                    r.font.bold = True
                    r.font.color.rgb = COLOR_PRIMARY
                elif c_idx == 1:
                    r.font.color.rgb = COLOR_SECONDARY
                else:
                    r.font.color.rgb = COLOR_DARK

    # Section 4: Data Flow Walkthrough
    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(16)
    h4.paragraph_format.space_after = Pt(6)
    r_h4 = h4.add_run("4. Real-Time Telemetry & Data Flow Walkthrough")
    r_h4.font.name = "Arial"
    r_h4.font.size = Pt(14)
    r_h4.font.bold = True
    r_h4.font.color.rgb = COLOR_PRIMARY

    flows = [
        ("Scenario A: Parent Live Bus Tracking Resolution", 
         "1. Parent logs in with email/password. System validates credentials and returns JWT token.\n"
         "2. App queries: SELECT * FROM students WHERE parentId = user.id. Returns Arman Dar (busId: 'bus_104').\n"
         "3. App queries: SELECT * FROM trips WHERE busId = 'bus_104' AND status = 'ACTIVE'.\n"
         "4. Parent app connects to Socket.io and joins vehicle room: socket.join('bus_104').\n"
         "5. Driver phone emits GPS coordinates every 1 second; parent receives updates with <500ms latency."),
        ("Scenario B: AI Driver Monitoring System (DMS) Violation Logging", 
         "1. Driver starts trip; background MediaPipe AI vision engine activates on Android device.\n"
         "2. On Foreshore Road, driver closes eyes for >1.5s (microsleep). On-device chime alerts driver immediately.\n"
         "3. Driver app sends HTTP POST to /api/dms/incident with { tripId, violationType: 'DROWSINESS', confidence: 0.94, speedKmh: 34 }.\n"
         "4. Backend inserts record into dms_incidents and recalculates trip.safetyScore (drops from 100 to 92).\n"
         "5. Server emits instant alert over WebSocket to school admin review dashboard: socket.to('school_kvs').emit('dms:alert').")
    ]

    for flow_title, flow_steps in flows:
        p_ft = doc.add_paragraph()
        p_ft.paragraph_format.space_before = Pt(8)
        p_ft.paragraph_format.space_after = Pt(2)
        r_ft = p_ft.add_run(flow_title)
        r_ft.font.name = "Arial"
        r_ft.font.size = Pt(11)
        r_ft.font.bold = True
        r_ft.font.color.rgb = COLOR_ACCENT

        p_fs = doc.add_paragraph()
        p_fs.paragraph_format.space_after = Pt(8)
        r_fs = p_fs.add_run(flow_steps)
        r_fs.font.name = "Arial"
        r_fs.font.size = Pt(9)
        r_fs.font.color.rgb = COLOR_DARK

    out_file = r"D:\RAAH\RAASTA_DATABASE_ARCHITECTURE_SPECIFICATION.docx"
    doc.save(out_file)
    print("Database Architecture Specification DOCX successfully generated at:", out_file)

if __name__ == "__main__":
    create_database_specs_document()
