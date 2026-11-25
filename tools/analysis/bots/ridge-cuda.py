"""Fit the frozen linear UNO residual model on the local GPU."""
import json
import math
import sys

import torch


def main():
    spec = json.load(sys.stdin)
    examples = spec["examples"]
    penalty = spec["penalty"]
    if not examples or not isinstance(penalty, (int, float)) or not math.isfinite(penalty) or penalty <= 0:
        raise ValueError("Linear ridge training requires examples and a positive penalty")
    if not torch.cuda.is_available():
        raise RuntimeError("UNO correction training requires the selected local CUDA GPU")
    device = torch.device("cuda")
    dtype = torch.float64
    features = torch.tensor([row["features"] for row in examples], device=device, dtype=dtype)
    target = torch.tensor([row["target"] for row in examples], device=device, dtype=dtype)
    weight = torch.tensor([row["weight"] for row in examples], device=device, dtype=dtype)
    if (
        features.ndim != 2
        or features.shape[1] == 0
        or not bool(torch.isfinite(features).all())
        or not bool(torch.isfinite(target).all())
        or not bool(torch.isfinite(weight).all())
        or not bool((weight > 0).all())
    ):
        raise ValueError("Invalid UNO ridge samples")
    weight = weight / weight.sum()
    normal = features.T @ (features * weight[:, None])
    normal.diagonal().add_(penalty)
    result = torch.linalg.solve(normal, features.T @ (target * weight))
    if not bool(torch.isfinite(result).all()):
        raise RuntimeError("UNO GPU fit returned non-finite coefficients")
    print(json.dumps({
        "coefficients": result.cpu().tolist(),
        "device": torch.cuda.get_device_name(device),
        "torch": torch.__version__,
    }))


if __name__ == "__main__":
    main()
