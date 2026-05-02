import re
import pandas as pd
import io
import math
from backend.models import PolarPoint, FileMetadata

def parse_file(content: bytes, filename: str) -> tuple[FileMetadata, list[PolarPoint]]:
    # Attempt to read as text first for XFLR5/CSV
    try:
        text = content.decode('utf-8')
        if "xflr5" in text.lower() or "calculated polar for:" in text.lower():
            return parse_xflr5_csv(text, filename)
        else:
            return parse_standard_csv(text, filename)
    except UnicodeDecodeError:
        # Probably an Excel file
        return parse_excel(content, filename)

def parse_xflr5_csv(text: str, filename: str) -> tuple[FileMetadata, list[PolarPoint]]:
    lines = text.split('\n')
    
    airfoil_name = "Unknown"
    reynolds_num = None
    mach_num = None
    ncrit = None
    
    data_start_idx = 0
    
    # Parse header
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if "calculated polar for:" in line_lower:
            airfoil_name = line.split(":")[-1].strip()
        
        if "mach =" in line_lower and "re =" in line_lower:
            # e.g., Mach =   0.000     Re =     0.267 e 6     Ncrit =   9.000
            try:
                mach_match = re.search(r"Mach\s*=\s*([0-9.]+)", line)
                if mach_match: mach_num = float(mach_match.group(1))
                
                re_match = re.search(r"Re\s*=\s*([0-9.]+)\s*e\s*([0-9]+)", line)
                if re_match: 
                    reynolds_num = float(re_match.group(1)) * (10 ** float(re_match.group(2)))
                
                ncrit_match = re.search(r"Ncrit\s*=\s*([0-9.]+)", line)
                if ncrit_match: ncrit = float(ncrit_match.group(1))
            except Exception:
                pass
                
        if line.strip().startswith("alpha,") or "alpha" in line_lower and "cl" in line_lower:
            data_start_idx = i
            break

    metadata = FileMetadata(
        filename=filename,
        airfoil_name=airfoil_name,
        reynolds_num=reynolds_num,
        mach_num=mach_num,
        ncrit=ncrit
    )
    
    # Parse data
    if data_start_idx == 0:
        # Fallback if we didn't find standard headers
        raise ValueError("Could not find data headers in XFLR5 file")
        
    df = pd.read_csv(io.StringIO("\n".join(lines[data_start_idx:])), skipinitialspace=True)
    df.columns = [c.strip() for c in df.columns]
    
    points = []
    for _, row in df.iterrows():
        try:
            # Handle NaN values explicitly
            def get_val(col, default=None):
                if col in row and not pd.isna(row[col]):
                    return float(row[col])
                return default

            if pd.isna(row['alpha']) or pd.isna(row['CL']) or pd.isna(row['CD']):
                continue
                
            point = PolarPoint(
                alpha=float(row['alpha']),
                CL=float(row['CL']),
                CD=float(row['CD']),
                CDp=get_val('CDp'),
                Cm=get_val('Cm'),
                Top_Xtr=get_val('Top Xtr'),
                Bot_Xtr=get_val('Bot Xtr'),
                Cpmin=get_val('Cpmin'),
                Chinge=get_val('Chinge'),
                XCp=get_val('XCp')
            )
            points.append(point)
        except Exception as e:
            print(f"Error parsing row: {e}")
            continue
            
    return metadata, points

def _normalize_df_columns(df: pd.DataFrame) -> pd.DataFrame:
    # Rename columns to standard ones based on case-insensitive matches
    col_map = {}
    for c in df.columns:
        c_lower = str(c).strip().lower()
        if c_lower == 'alpha': col_map[c] = 'alpha'
        elif c_lower == 'cl': col_map[c] = 'CL'
        elif c_lower == 'cd': col_map[c] = 'CD'
        elif c_lower == 'cm': col_map[c] = 'Cm'
    
    df = df.rename(columns=col_map)
    return df

def parse_standard_csv(text: str, filename: str) -> tuple[FileMetadata, list[PolarPoint]]:
    df = pd.read_csv(io.StringIO(text))
    df = _normalize_df_columns(df)
    
    if not all(c in df.columns for c in ['alpha', 'CL', 'CD']):
        raise ValueError("File must contain at least 'alpha', 'CL', and 'CD' columns")
        
    metadata = FileMetadata(filename=filename)
    return metadata, _df_to_points(df)

def parse_excel(content: bytes, filename: str) -> tuple[FileMetadata, list[PolarPoint]]:
    df = pd.read_excel(io.BytesIO(content))
    df = _normalize_df_columns(df)
    
    if not all(c in df.columns for c in ['alpha', 'CL', 'CD']):
        raise ValueError("File must contain at least 'alpha', 'CL', and 'CD' columns")
        
    metadata = FileMetadata(filename=filename)
    return metadata, _df_to_points(df)

def _df_to_points(df: pd.DataFrame) -> list[PolarPoint]:
    points = []
    has_cm = 'Cm' in df.columns
    for _, row in df.iterrows():
        if pd.isna(row['alpha']) or pd.isna(row['CL']) or pd.isna(row['CD']):
            continue
        point = PolarPoint(
            alpha=float(row['alpha']),
            CL=float(row['CL']),
            CD=float(row['CD']),
            Cm=float(row['Cm']) if has_cm and not pd.isna(row['Cm']) else None
        )
        points.append(point)
    # Sort by alpha
    points.sort(key=lambda p: p.alpha)
    return points
