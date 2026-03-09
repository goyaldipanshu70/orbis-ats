"""
One-time migration script: splits intesa_hr_db into auth_db and recruiting_db.

Usage:
    python scripts/migrate_db.py --uri "mongodb://admin:admin123@localhost:27017" --source intesa_hr_db

Collections migrated:
    intesa_hr_db.users       → auth_db.users
    intesa_hr_db.settings    → auth_db.settings
    intesa_hr_db.job_descriptions → recruiting_db.job_descriptions
    intesa_hr_db.candidates  → recruiting_db.candidates
    intesa_hr_db.interview_evaluations → recruiting_db.interview_evaluations
"""

import argparse
from pymongo import MongoClient


COLLECTION_MAP = {
    "auth_db": ["users", "settings"],
    "recruiting_db": ["job_descriptions", "candidates", "interview_evaluations"],
}


def migrate(uri: str, source_db: str):
    client = MongoClient(uri)
    source = client[source_db]

    for target_db_name, collections in COLLECTION_MAP.items():
        target = client[target_db_name]
        for col_name in collections:
            src_col = source[col_name]
            tgt_col = target[col_name]

            count = src_col.count_documents({})
            if count == 0:
                print(f"  ⚠️  {source_db}.{col_name} is empty, skipping")
                continue

            docs = list(src_col.find({}))
            tgt_col.insert_many(docs, ordered=False)
            print(f"  ✅ Migrated {count} docs: {source_db}.{col_name} → {target_db_name}.{col_name}")

    client.close()
    print("\n🎉 Migration complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate intesa_hr_db to split microservice DBs")
    parser.add_argument("--uri", required=True, help="MongoDB connection URI")
    parser.add_argument("--source", default="intesa_hr_db", help="Source database name")
    args = parser.parse_args()

    print(f"Migrating from {args.source}...\n")
    migrate(args.uri, args.source)
