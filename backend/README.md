# Knowledge Graph Backend

Flask REST API backend for the Knowledge Graph project.

## Structure

```
backend/
├── app/
│   ├── __init__.py          # Flask app factory
│   ├── config.py             # Configuration settings
│   ├── extensions.py         # Flask extensions (SQLAlchemy, etc.)
│   ├── modules/              # Feature modules (matching frontend structure)
│   │   ├── digital_twin_dashboard/
│   │   ├── digital_twin_solution/
│   │   ├── dx_work_process/
│   │   ├── gantt_chart/
│   │   ├── knowledge_graph/
│   │   ├── swimlane_chart/
│   │   ├── tech_archive/
│   │   └── tech_radar/
│   └── shared/               # Shared utilities
├── migrations/               # Database migrations
├── tests/                    # Test files
├── requirements.txt          # Python dependencies
├── run.py                    # Entry point
└── .env.example              # Environment variables template
```

## Setup

1. Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Setup environment variables:
```bash
copy .env.example .env  # Windows
cp .env.example .env    # Linux/Mac
# Edit .env with your settings
```

4. Setup PostgreSQL database:
```bash
# Create database
createdb knowledge_graph_db
```

5. Initialize database:
```bash
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

6. Run the server:
```bash
python run.py
```

## API Endpoints

### DX Work Process (Knowledge Graph)
- `GET /api/dx-work-process/graphs` - Get all graphs
- `GET /api/dx-work-process/graphs/<id>` - Get single graph
- `POST /api/dx-work-process/graphs` - Create graph
- `PUT /api/dx-work-process/graphs/<id>` - Update graph
- `DELETE /api/dx-work-process/graphs/<id>` - Delete graph
- `POST /api/dx-work-process/graphs/<id>/data` - Save graph data (nodes & edges)

### Health Check (All Modules)
- `GET /api/<module>/health` - Health check endpoint

## Development

Run with debug mode:
```bash
FLASK_ENV=development python run.py
```

Run tests:
```bash
pytest
```
