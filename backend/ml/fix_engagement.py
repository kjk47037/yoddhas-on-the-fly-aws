import pandas as pd
import glob
import os

# Get the latest CSV file
csv_files = glob.glob('ml/training_data/processed_features_gucci_*.csv')
latest_file = sorted(csv_files)[-1]

print(f"Fixing engagement rates in {latest_file}")

# Read the CSV
df = pd.read_csv(latest_file)

# Calculate total engagement and new engagement rate
df['total_engagement'] = df['favorite_count'] + df['retweet_count'] + df['reply_count']
df['engagement_rate'] = (df['total_engagement'] / 7173222) * 100  # Gucci's follower count

# Save to new file
timestamp = pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')
new_file = f'ml/training_data/processed_features_gucci_{timestamp}_fixed.csv'
df.to_csv(new_file, index=False)

print(f"\nOld engagement rates (first 5):")
print(df['engagement_rate'].head().to_string())

print(f"\nSaved fixed data to: {new_file}") 