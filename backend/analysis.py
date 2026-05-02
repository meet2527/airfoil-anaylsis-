import numpy as np
from scipy.interpolate import CubicSpline
from scipy.signal import savgol_filter
from backend.models import PolarPoint, AnalysisResult
from typing import List

def analyze_polar(points: List[PolarPoint]) -> AnalysisResult:
    if len(points) < 5:
        raise ValueError("Need at least 5 points for proper analysis")
        
    alphas = np.array([p.alpha for p in points])
    CLs = np.array([p.CL for p in points])
    CDs = np.array([p.CD for p in points])
    
    has_cm = all(p.Cm is not None for p in points)
    Cms = np.array([p.Cm for p in points]) if has_cm else None

    # 1. Basic Extremes
    cl_max_idx = np.argmax(CLs)
    cd_min_idx = np.argmin(CDs)
    
    LDs = CLs / CDs
    ld_max_idx = np.argmax(LDs)

    CL_max = float(CLs[cl_max_idx])
    CD_min = float(CDs[cd_min_idx])
    
    # 2. Stall Detection (Derivative method)
    # Using Savitzky-Golay filter to smooth the derivative dCL/dalpha
    # window_length must be odd, polyorder must be < window_length
    window_length = min(7, len(alphas) if len(alphas) % 2 != 0 else len(alphas) - 1)
    if window_length >= 3:
        # Calculate dCL/dalpha
        dCL_dalpha = np.gradient(CLs, alphas)
        dCL_dalpha_smooth = savgol_filter(dCL_dalpha, window_length, 2)
        
        # Find linear region (approx between alpha=0 and alpha=5, or lowest CD region)
        # Linear region is where dCL_dalpha is relatively constant and high
        lin_start_idx = max(0, cd_min_idx - 5)
        lin_end_idx = min(len(alphas) - 1, cd_min_idx + 5)
        if lin_end_idx <= lin_start_idx:
            lin_end_idx = len(alphas) - 1
            lin_start_idx = 0
            
        linear_slope_avg = np.mean(dCL_dalpha_smooth[lin_start_idx:lin_end_idx])
        
        # Stall onset is where slope drops to 50% of linear region, before CL max
        stall_onset_idx = cl_max_idx
        for i in range(lin_end_idx, cl_max_idx):
            if dCL_dalpha_smooth[i] < 0.5 * linear_slope_avg:
                stall_onset_idx = i
                break
                
        alpha_stall = float(alphas[stall_onset_idx])
        stall_idx_res = int(stall_onset_idx)
    else:
        # Fallback to pure CL max
        alpha_stall = float(alphas[cl_max_idx])
        stall_idx_res = int(cl_max_idx)

    # 3. Lift Curve Slope (CL_alpha)
    # Linear regression in the attached region (before stall onset)
    linear_region = (alphas > (alphas[0] + 1)) & (alphas < alpha_stall - 2)
    CL_alpha = None
    CL_alpha_deg = None
    if np.sum(linear_region) >= 3:
        fit = np.polyfit(alphas[linear_region], CLs[linear_region], 1)
        CL_alpha_deg = float(fit[0])  # per degree
        CL_alpha = CL_alpha_deg * (180.0 / np.pi)  # per radian

    # 4. Zero Lift Angle
    alpha_zero_lift = None
    if np.min(CLs) <= 0 and np.max(CLs) >= 0:
        # Cubic spline to find accurate crossing
        try:
            # Spline requires strictly increasing x, which alpha should be
            cs = CubicSpline(alphas, CLs)
            roots = cs.roots()
            # Find the root closest to the middle of our data
            if len(roots) > 0:
                valid_roots = [r for r in roots if alphas[0] <= r <= alphas[-1]]
                if valid_roots:
                    alpha_zero_lift = float(valid_roots[0])
        except Exception:
            # Linear interpolation fallback
            for i in range(len(alphas) - 1):
                if CLs[i] <= 0 and CLs[i+1] > 0:
                    t = -CLs[i] / (CLs[i+1] - CLs[i])
                    alpha_zero_lift = float(alphas[i] + t * (alphas[i+1] - alphas[i]))
                    break

    # 5. Pitching Moment Analysis
    Cm_zero_lift = None
    Cm_alpha = None
    if has_cm:
        if alpha_zero_lift is not None:
            try:
                cs_cm = CubicSpline(alphas, Cms)
                Cm_zero_lift = float(cs_cm(alpha_zero_lift))
            except Exception:
                pass
                
        if np.sum(linear_region) >= 3:
            fit_cm = np.polyfit(alphas[linear_region], Cms[linear_region], 1)
            Cm_alpha = float(fit_cm[0]) * (180.0 / np.pi) # per radian

    # 6. Drag Decomposition (CD = CD0 + k*CL^2)
    CD0 = None
    oswald_e = None
    # Fit quadratic to the low drag region (e.g. CL between -0.2 and 0.8)
    drag_region = (CLs > -0.2) & (CLs < 0.8)
    if np.sum(drag_region) >= 4:
        try:
            # We fit CD vs CL^2
            pfit = np.polyfit(CLs[drag_region]**2, CDs[drag_region], 1)
            # pfit[0] is k, pfit[1] is CD0
            if pfit[1] > 0 and pfit[0] > 0:
                CD0 = float(pfit[1])
                k = pfit[0]
                # Assuming high AR, e = 1 / (pi * AR * k)
                # Without AR, we can't compute exact Oswald efficiency, 
                # but we can return k (1/(pi*e*AR)) or just leave e as None unless AR is given.
                # Let's just return CD0.
        except Exception:
            pass

    return AnalysisResult(
        CL_max=CL_max,
        alpha_stall=alpha_stall,
        CD_min=CD_min,
        alpha_CD_min=float(alphas[cd_min_idx]),
        LD_max=float(LDs[ld_max_idx]),
        alpha_LD_max=float(alphas[ld_max_idx]),
        alpha_zero_lift=alpha_zero_lift,
        CL_alpha=CL_alpha,
        CL_alpha_deg=CL_alpha_deg,
        Cm_zero_lift=Cm_zero_lift,
        Cm_alpha=Cm_alpha,
        CD0=CD0,
        oswald_e=None, # Needs Aspect Ratio
        stall_idx=stall_idx_res
    )
