#!/usr/bin/env swift

import Foundation
import Vision
import CoreGraphics
import ImageIO

struct BenchResult: Codable {
    let mode: String
    let runAvgMs: Double
    let runP50Ms: Double
    let runValuesMs: [Double]
    let perWordAvgMs: Double
    let wordOutputs: [String]
    let rawOutputs: [String]
    let accVisual12: Double
    let accCorrected12: Double
}

struct Report: Codable {
    let image: String
    let runs: Int
    let warmup: Int
    let results: [BenchResult]
}

let gtVisual = [
    "innocent", "open", "tag", "iandom", "ecology", "copper",
    "multiply", "wool", "glance", "test", "palace", "tray",
]
let gtCorrected = [
    "innocent", "open", "tag", "random", "ecology", "copper",
    "multiply", "wool", "glance", "test", "palace", "tray",
]

let rowY = [276, 362, 447, 533, 618, 704]
let rowH = 62
let leftX = (45, 332)
let rightX = (334, 605)

func extractAlphaToken(_ s: String) -> String {
    let pattern = "[A-Za-z]+"
    guard let regex = try? NSRegularExpression(pattern: pattern) else { return "" }
    let ns = s as NSString
    let matches = regex.matches(in: s, range: NSRange(location: 0, length: ns.length))
    if matches.isEmpty { return "" }
    var best = ""
    for m in matches {
        let t = ns.substring(with: m.range).lowercased()
        if t.count > best.count { best = t }
    }
    return best
}

func median(_ arr: [Double]) -> Double {
    if arr.isEmpty { return 0 }
    let s = arr.sorted()
    if s.count % 2 == 1 { return s[s.count / 2] }
    return (s[s.count / 2 - 1] + s[s.count / 2]) / 2.0
}

func mean(_ arr: [Double]) -> Double {
    if arr.isEmpty { return 0 }
    return arr.reduce(0, +) / Double(arr.count)
}

func score(_ pred: [String], _ gt: [String]) -> Double {
    guard pred.count == gt.count, !gt.isEmpty else { return 0 }
    var ok = 0
    for i in 0..<gt.count where pred[i] == gt[i] { ok += 1 }
    return Double(ok) / Double(gt.count)
}

func makeROIs(imgW: Double, imgH: Double) -> [CGRect] {
    var rois: [CGRect] = []
    for y in rowY {
        let h = Double(rowH)
        let yBottom = imgH - Double(y) - h

        let lX = Double(leftX.0)
        let lW = Double(leftX.1 - leftX.0)
        rois.append(
            CGRect(
                x: lX / imgW,
                y: yBottom / imgH,
                width: lW / imgW,
                height: h / imgH
            )
        )

        let rX = Double(rightX.0)
        let rW = Double(rightX.1 - rightX.0)
        rois.append(
            CGRect(
                x: rX / imgW,
                y: yBottom / imgH,
                width: rW / imgW,
                height: h / imgH
            )
        )
    }
    return rois
}

func runMode(
    mode: String,
    level: VNRequestTextRecognitionLevel,
    cgImage: CGImage,
    rois: [CGRect],
    runs: Int,
    warmup: Int
) throws -> BenchResult {
    func inferOne(roi: CGRect) throws -> (String, String) {
        let req = VNRecognizeTextRequest()
        req.recognitionLevel = level
        req.usesLanguageCorrection = true
        req.recognitionLanguages = ["en-US"]
        req.regionOfInterest = roi

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        try handler.perform([req])
        guard
            let results = req.results,
            let topObs = results.first,
            let top = topObs.topCandidates(1).first
        else {
            return ("", "")
        }
        let raw = top.string
        return (raw, extractAlphaToken(raw))
    }

    for _ in 0..<warmup {
        for roi in rois { _ = try inferOne(roi: roi) }
    }

    var runMs: [Double] = []
    var finalRaw: [String] = []
    var finalWord: [String] = []

    for r in 0..<runs {
        let st = DispatchTime.now().uptimeNanoseconds
        var raws: [String] = []
        var words: [String] = []
        for roi in rois {
            let (raw, word) = try inferOne(roi: roi)
            raws.append(raw)
            words.append(word)
        }
        let ed = DispatchTime.now().uptimeNanoseconds
        runMs.append(Double(ed - st) / 1_000_000.0)
        if r == runs - 1 {
            finalRaw = raws
            finalWord = words
        }
    }

    let avg = mean(runMs)
    return BenchResult(
        mode: mode,
        runAvgMs: avg,
        runP50Ms: median(runMs),
        runValuesMs: runMs.map { Double(round($0 * 100.0) / 100.0) },
        perWordAvgMs: avg / 12.0,
        wordOutputs: finalWord,
        rawOutputs: finalRaw,
        accVisual12: score(finalWord, gtVisual),
        accCorrected12: score(finalWord, gtCorrected)
    )
}

func main() throws {
    var imagePath: String?
    var runs = 3
    var warmup = 1

    var i = 1
    let args = CommandLine.arguments
    while i < args.count {
        switch args[i] {
        case "--image":
            i += 1
            if i < args.count { imagePath = args[i] }
        case "--runs":
            i += 1
            if i < args.count, let v = Int(args[i]) { runs = v }
        case "--warmup":
            i += 1
            if i < args.count, let v = Int(args[i]) { warmup = v }
        default:
            break
        }
        i += 1
    }

    guard let imagePath, !imagePath.isEmpty else {
        throw NSError(domain: "bench", code: 1, userInfo: [NSLocalizedDescriptionKey: "--image is required"])
    }
    let imageURL = URL(fileURLWithPath: imagePath)
    guard let src = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
          let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
        throw NSError(domain: "bench", code: 2, userInfo: [NSLocalizedDescriptionKey: "failed to open image"])
    }

    let rois = makeROIs(imgW: Double(cg.width), imgH: Double(cg.height))
    if rois.count != 12 {
        throw NSError(domain: "bench", code: 3, userInfo: [NSLocalizedDescriptionKey: "invalid ROI count"])
    }

    let accurate = try runMode(
        mode: "vision-accurate",
        level: .accurate,
        cgImage: cg,
        rois: rois,
        runs: runs,
        warmup: warmup
    )
    let fast = try runMode(
        mode: "vision-fast",
        level: .fast,
        cgImage: cg,
        rois: rois,
        runs: runs,
        warmup: warmup
    )

    let report = Report(image: imagePath, runs: runs, warmup: warmup, results: [accurate, fast])
    let enc = JSONEncoder()
    enc.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
    let data = try enc.encode(report)
    if let text = String(data: data, encoding: .utf8) {
        print(text)
    }
}

do {
    try main()
} catch {
    fputs("error: \(error)\n", stderr)
    exit(1)
}
