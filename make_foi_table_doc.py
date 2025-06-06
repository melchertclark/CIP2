#!/usr/bin/env python3
"""
Script to generate a Word document of FOI population & programs using a Jinja-enabled template (docxtpl).

Usage:
    python make_foi_table_doc.py <input_json> <output_docx> [cip_json_path]

If cip_json_path is provided, its filename (without extension) will be used as the 'school' context for {{ school }}.
"""
import sys
import os
import json
from datetime import date

from docxtpl import DocxTemplate
from jinja2 import Environment


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <input_json> <output_docx>", file=sys.stderr)
        sys.exit(1)

    input_json = sys.argv[1]
    output_docx = sys.argv[2]

    with open(input_json, encoding='utf-8') as f:
        entries = json.load(f)

    # derive school name from CIP JSON path if provided as third argument
    if len(sys.argv) >= 4:
        school = os.path.splitext(os.path.basename(sys.argv[3]))[0]
    else:
        school = ''

    # normalize entries: compute rank, unify FOI name key, ensure programs list of strings
    processed_entries = []
    for idx, entry in enumerate(entries):
        rank = entry.get('rank', idx + 1)
        foi_name = entry.get('foi_name') or entry.get('foiName') or ''
        programs = entry.get('programs', [])
        if programs and isinstance(programs[0], dict):
            programs = [p.get('name', '') for p in programs]
        processed_entries.append({
            'rank': rank,
            'foi_name': foi_name,
            'programs': programs,
        })

    script_dir = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(script_dir, 'Variation List Template-2.docx')

    # Create a Jinja2 environment that trims whitespace around block tags to avoid blank rows
    jinja_env = Environment(trim_blocks=True, lstrip_blocks=True)
    doc = DocxTemplate(template_path)
    context = {
        'school': school,
        'date': date.today().isoformat(),
        'foi_entries': processed_entries,
    }
    doc.render(context, jinja_env=jinja_env)
    # Remove any completely empty table rows (cells with only whitespace)
    for table in doc.docx.tables:
        for row in list(table.rows):
            if all(cell.text.strip() == "" for cell in row.cells):
                table._tbl.remove(row._tr)
    doc.save(output_docx)
    print(f"Generated Word document: {output_docx}")


if __name__ == '__main__':
    main()