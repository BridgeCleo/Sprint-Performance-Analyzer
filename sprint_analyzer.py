"""
Cleo Bridge
University of Vermont
Sprint Analyzer
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os


def get_png_folder():
    program_folder = os.path.dirname(os.path.abspath(__file__))
    png_folder = os.path.join(program_folder, "PNG's Data")
    os.makedirs(png_folder, exist_ok=True)
    return png_folder


def save_graph(filename):
    filepath = os.path.join(get_png_folder(), filename)
    plt.savefig(filepath)
    return filepath


def get_graph_label(label):
    label = label.strip().strip('"').strip("'")
    label = os.path.basename(label)
    label = os.path.splitext(label)[0]

    safe_label = ""

    for character in label:
        if character.isalnum() or character in ["-", "_"]:
            safe_label += character
        else:
            safe_label += "_"

    while "__" in safe_label:
        safe_label = safe_label.replace("__", "_")

    safe_label = safe_label.strip("_")

    if safe_label == "":
        safe_label = "sprint"

    return safe_label


def get_display_label(label):
    label = label.strip().strip('"').strip("'")
    label = os.path.basename(label)
    label = os.path.splitext(label)[0]

    if label == "":
        label = "Sprint"

    return label

#AI was used rather heavily for this top section, wanted the PNG's to save to a specific folder and needed help.

def load_data(filename):
    filename = filename.strip().strip('"').strip("'")

    if not os.path.exists(filename):
        program_folder = os.path.dirname(os.path.abspath(__file__))
        filename_in_program_folder = os.path.join(program_folder, filename)

        if os.path.exists(filename_in_program_folder):
            filename = filename_in_program_folder

    try:
        data = pd.read_csv(filename)
        return data
    except FileNotFoundError:
        print("Error: File not found. Check the filename and try again.")
        return None


def validate_data(data):
    required_columns = ["time", "distance"]

    for column in required_columns:
        if column not in data.columns:
            print(f"Error: Missing required column: {column}")
            return False

    data["time"] = pd.to_numeric(data["time"], errors="coerce")
    data["distance"] = pd.to_numeric(data["distance"], errors="coerce")

    if data.isnull().values.any():
        print("Error: The file contains missing or non-numeric values.")
        return False

    if len(data) < 3:
        print("Error: The dataset needs at least 3 rows.")
        return False

    if (data["time"] < 0).any():
        print("Error: Time values cannot be negative.")
        return False

    if not data["time"].is_monotonic_increasing:
        print("Error: Time values must be increasing.")
        return False

    if data["time"].duplicated().any():
        print("Error: Time values cannot repeat.")
        return False

    return True


def get_sprint_phases(data):
    start_time = data["time"].iloc[0]
    end_time = data["time"].iloc[-1]
    total_time = end_time - start_time

    phases = [
        {
            "name": "Start / Drive Phase",
            "short_name": "Start",
            "start": start_time,
            "end": start_time + total_time * 0.20,
        },
        {
            "name": "Acceleration Phase",
            "short_name": "Accel",
            "start": start_time + total_time * 0.20,
            "end": start_time + total_time * 0.50,
        },
        {
            "name": "Maximum Velocity Phase",
            "short_name": "Max V",
            "start": start_time + total_time * 0.50,
            "end": start_time + total_time * 0.80,
        },
        {
            "name": "Deceleration Phase",
            "short_name": "Decel",
            "start": start_time + total_time * 0.80,
            "end": end_time,
        },
    ]

    return phases


def get_phase_stats(data, phases):
    time_values = data["time"].to_numpy()
    distance_values = data["distance"].to_numpy()
    velocity_values = data["velocity"].to_numpy()
    acceleration_values = data["acceleration"].to_numpy()

    phase_stats = []

    for phase in phases:
        start = phase["start"]
        end = phase["end"]

        phase_rows = data[(data["time"] >= start) & (data["time"] <= end)]

        start_distance = np.interp(start, time_values, distance_values)
        end_distance = np.interp(end, time_values, distance_values)
        start_velocity = np.interp(start, time_values, velocity_values)
        end_velocity = np.interp(end, time_values, velocity_values)
        start_acceleration = np.interp(start, time_values, acceleration_values)
        end_acceleration = np.interp(end, time_values, acceleration_values)

        velocities = list(phase_rows["velocity"])
        velocities.append(start_velocity)
        velocities.append(end_velocity)

        accelerations = list(phase_rows["acceleration"])
        accelerations.append(start_acceleration)
        accelerations.append(end_acceleration)

        stats = {
            "name": phase["name"],
            "short_name": phase["short_name"],
            "start": start,
            "end": end,
            "average_velocity": np.mean(velocities),
            "max_velocity": np.max(velocities),
            "average_acceleration": np.mean(accelerations),
            "distance_covered": end_distance - start_distance,
        }

        phase_stats.append(stats)

    return phase_stats


def print_phase_breakdown(phase_stats):
    print("\nSprint Phase Breakdown")
    print("----------------------")

    for phase in phase_stats:
        print(f"\n{phase['name']} ({phase['start']:.2f} to {phase['end']:.2f} seconds)")
        print(f"Average Velocity: {phase['average_velocity']:.2f} m/s")
        print(f"Maximum Velocity: {phase['max_velocity']:.2f} m/s")
        print(f"Average Acceleration: {phase['average_acceleration']:.2f} m/s^2")
        print(f"Distance Covered: {phase['distance_covered']:.2f} meters")


def analyze_sprint(data, label):
    data["velocity"] = np.gradient(data["distance"], data["time"])
    data["acceleration"] = np.gradient(data["velocity"], data["time"])

    total_time = data["time"].iloc[-1] - data["time"].iloc[0]
    total_distance = data["distance"].iloc[-1] - data["distance"].iloc[0]
    average_velocity = total_distance / total_time
    max_velocity = data["velocity"].max()
    peak_acceleration = data["acceleration"].max()

    print(f"\nSprint Performance Report: {label}")
    print("-------------------------")
    print(f"Total Sprint Time: {total_time:.2f} seconds")
    print(f"Total Distance: {total_distance:.2f} meters")
    print(f"Average Velocity: {average_velocity:.2f} m/s")
    print(f"Maximum Velocity: {max_velocity:.2f} m/s")
    print(f"Peak Acceleration: {peak_acceleration:.2f} m/s^2")

    phases = get_sprint_phases(data)
    phase_stats = get_phase_stats(data, phases)
    print_phase_breakdown(phase_stats)

    return data, phases


def add_phase_shading(axis, phases):
    colors = ["lightblue", "lightgreen", "khaki", "lightcoral"]
    top_of_graph = axis.get_ylim()[1]

    for i in range(len(phases)):
        phase = phases[i]
        axis.axvspan(phase["start"], phase["end"], color=colors[i], alpha=0.25)

        middle = (phase["start"] + phase["end"]) / 2
        axis.text(
            middle,
            top_of_graph,
            phase["short_name"],
            ha="center",
            va="top",
            fontsize=8,
        )


def make_graphs(data, phases, label):
    graph_label = get_graph_label(label)
    display_label = get_display_label(label)

    plt.figure()
    plt.plot(data["time"], data["velocity"], marker="o", label=display_label)
    plt.title(f"{display_label}: Velocity vs. Time")
    plt.xlabel("Time (seconds)")
    plt.ylabel("Velocity (m/s)")
    plt.grid(True)
    add_phase_shading(plt.gca(), phases)
    plt.legend()
    velocity_graph = save_graph(f"{graph_label}_velocity_vs_time.png")
    plt.close()

    plt.figure()
    plt.plot(data["time"], data["acceleration"], marker="o", label=display_label)
    plt.title(f"{display_label}: Acceleration vs. Time")
    plt.xlabel("Time (seconds)")
    plt.ylabel("Acceleration (m/s^2)")
    plt.grid(True)
    add_phase_shading(plt.gca(), phases)
    plt.legend()
    acceleration_graph = save_graph(f"{graph_label}_acceleration_vs_time.png")
    plt.close()

    print("Graphs saved successfully.")
    return velocity_graph, acceleration_graph


def get_percent_time(data):
    start_time = data["time"].iloc[0]
    end_time = data["time"].iloc[-1]
    total_time = end_time - start_time
    percent_time = (data["time"] - start_time) / total_time * 100
    return percent_time


def get_percent_phases():
    phases = [
        {"short_name": "Start", "start": 0, "end": 20},
        {"short_name": "Accel", "start": 20, "end": 50},
        {"short_name": "Max V", "start": 50, "end": 80},
        {"short_name": "Decel", "start": 80, "end": 100},
    ]

    return phases


def make_comparison_graphs(data1, label1, data2, label2):
    graph_label1 = get_graph_label(label1)
    graph_label2 = get_graph_label(label2)
    comparison_label = f"{graph_label1}_vs_{graph_label2}"
    display_label1 = get_display_label(label1)
    display_label2 = get_display_label(label2)

    percent_time1 = get_percent_time(data1)
    percent_time2 = get_percent_time(data2)
    phases = get_percent_phases()

    plt.figure()
    plt.plot(percent_time1, data1["velocity"], marker="o", label=display_label1)
    plt.plot(percent_time2, data2["velocity"], marker="s", label=display_label2)
    plt.title(f"{display_label1} vs. {display_label2}: Velocity Comparison")
    plt.xlabel("Sprint Completed (%)")
    plt.ylabel("Velocity (m/s)")
    plt.grid(True)
    add_phase_shading(plt.gca(), phases)
    plt.legend()
    velocity_comparison_graph = save_graph(f"{comparison_label}_velocity_comparison.png")
    plt.close()

    plt.figure()
    plt.plot(percent_time1, data1["acceleration"], marker="o", label=display_label1)
    plt.plot(percent_time2, data2["acceleration"], marker="s", label=display_label2)
    plt.title(f"{display_label1} vs. {display_label2}: Acceleration Comparison")
    plt.xlabel("Sprint Completed (%)")
    plt.ylabel("Acceleration (m/s^2)")
    plt.grid(True)
    add_phase_shading(plt.gca(), phases)
    plt.legend()
    acceleration_comparison_graph = save_graph(f"{comparison_label}_acceleration_comparison.png")
    plt.close()

    print("Comparison graphs saved successfully.")
    return velocity_comparison_graph, acceleration_comparison_graph


def ask_number_of_files():
    while True:
        choice = input("Analyze one CSV file or two CSV files? Enter 1 or 2: ")
        choice = choice.strip().lower()

        if choice == "1" or choice == "one":
            return 1
        elif choice == "2" or choice == "two":
            return 2
        else:
            print("Please enter 1 or 2.")


def main():
    print("Sprint Performance Data Analyzer")
    number_of_files = ask_number_of_files()

    if number_of_files == 1:
        filename = input("Enter CSV filename: ")

        data = load_data(filename)

        if data is None:
            return

        if not validate_data(data):
            return

        data, phases = analyze_sprint(data, filename)
        graph_paths = make_graphs(data, phases, filename)

        print("\nGraphs saved as:")
        for graph_path in graph_paths:
            print(graph_path)

    else:
        filename1 = input("Enter first CSV filename: ")
        filename2 = input("Enter second CSV filename: ")

        data1 = load_data(filename1)
        data2 = load_data(filename2)

        if data1 is None or data2 is None:
            return

        print(f"\nChecking {filename1}...")
        if not validate_data(data1):
            return

        print(f"Checking {filename2}...")
        if not validate_data(data2):
            return

        data1, phases1 = analyze_sprint(data1, filename1)
        data2, phases2 = analyze_sprint(data2, filename2)

        graph_paths = []
        graph_paths.extend(make_graphs(data1, phases1, filename1))
        graph_paths.extend(make_graphs(data2, phases2, filename2))
        graph_paths.extend(make_comparison_graphs(data1, filename1, data2, filename2))

        print("\nGraphs saved as:")
        for graph_path in graph_paths:
            print(graph_path)


main()

#Sources for learning to use imports: https://numpy.org/doc/2.1/reference/generated/numpy.gradient.html / https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.iloc.html#pandas.DataFrame.iloc
