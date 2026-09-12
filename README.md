# Sprint Performance Data Analyzer


A Python and browser-based application for analyzing sprint performance from time-distance CSV data.

The project calculates velocity, acceleration, sprint-phase metrics, and comparative sprint profiles to explore sprint mechanics and human performance.

---

## Description

This program analyzes sprint performance using time and distance data from CSV files. It applies basic kinematic principles from physics to calculate velocity and acceleration throughout a sprint. The program can analyze one sprint file or compare two sprint files.

The analyzer computes key performance metrics including total sprint time, total distance, average velocity, maximum velocity, and peak acceleration. It also divides each sprint into four performance phases:

- Start / Drive Phase: 0-20%
- Acceleration Phase: 20-50%
- Maximum Velocity Phase: 50-80%
- Deceleration Phase: 80-100%

For each phase, the program reports start and end time, average velocity, maximum velocity, average acceleration, and distance covered.

The project demonstrates real-world applications of physics and biomechanics by analyzing sprint motion, including acceleration, maximum velocity, and deceleration phases. The dataset from Usain Bolt's 100m world record is included for demonstration along with Michael Frater's 100m sprint for comparison.

---

Example of Graphs Produced

<img width="640" height="480" alt="real_bolt_100m_vs_real_frater_100m_acceleration_comparison" src="https://github.com/user-attachments/assets/056a9cf7-8825-4f00-8bcb-eb0f3fd8818b" />





---

## How to Run the Program

1. Make sure Python is installed on your computer.

2. Install required libraries by running:

   ```bash
   pip install -r requirements.txt
   ```

3. Run the program with:

   ```bash
   python sprint_analyzer.py
   ```

4. When prompted, choose whether to analyze one CSV file or compare two CSV files.

5. Enter the CSV filename or path when prompted. Example:

   ```
   data/real_bolt_100m.csv
   ```

---

## CSV File Format

The input file must be a CSV file with two required columns:

- `time` in seconds
- `distance` in meters

Example format:

```csv
time,distance
0,0
1.89,10
2.88,20
...
```

---

## Data Validation

The program checks each CSV file before analyzing it. A file must meet all of these rules:

- Required columns: `time`, `distance`
- Values must be numeric
- No missing values
- At least 3 rows
- Time values cannot be negative
- Time values must be increasing
- Time values cannot repeat

If the data is invalid, the program displays a clear error message instead of crashing.

---

## Features

- Reads sprint data from one CSV file or two CSV files
- Validates input data and handles errors gracefully
- Calculates velocity using change in distance over time
- Calculates acceleration using change in velocity over time
- Computes summary statistics:
  - Total sprint time
  - Total distance
  - Average velocity
  - Maximum velocity
  - Peak acceleration
- Breaks the sprint into four performance phases:
  - Start / Drive Phase
  - Acceleration Phase
  - Maximum Velocity Phase
  - Deceleration Phase
- Computes phase statistics:
  - Start and end time
  - Average velocity
  - Maximum velocity
  - Average acceleration
  - Distance covered
- Generates graphs:
  - Velocity vs. Time
  - Acceleration vs. Time
- When two files are used, generates comparison graphs:
  - Velocity Comparison by percent of sprint completed
  - Acceleration Comparison by percent of sprint completed
- Adds shaded phase regions to graphs with labels:
  - Start
  - Accel
  - Max V
  - Decel
- Saves graphs as PNG image files

---

## Testing

The program was tested using multiple datasets, including:

- Real-world sprint data, such as 100m race split times
- Files with missing values
- Files with non-numeric data
- Files with incorrect column names
- Files with too few rows
- Files with negative time values
- Files with repeated time values
- Files with time values that are not increasing

These tests ensure the program behaves correctly and does not crash when given invalid input.


---

## Notes

- Graphs will be saved as PNG files when the program runs.
- All required libraries can be installed using pip.
- The Python project is fully self-contained after dependencies are installed and does not require internet access to run.

---

## Website Version

A website version of this project is also included in this folder. It lets users upload one or two CSV files through a browser, validates the data, calculates the same sprint metrics, displays phase breakdowns, and shows interactive charts.

To open the website, double-click:

```text
index.html
```

The website performs the calculations locally in the browser. The charts use Chart.js from a CDN, so an internet connection is needed for the charts unless the library is already cached.
