import pandas as pd
import numpy as np

# Read the data
df = pd.read_csv('ml/training_data/processed_features_gucci_20250722_173707_fixed.csv')

print("Data Shape:", df.shape)

print("\nValue counts for binary features:")
binary_cols = ['has_image', 'is_product_post', 'is_promotional', 'is_engagement_post', 'has_price']
for col in binary_cols:
    print(f"\n{col}:")
    print(df[col].value_counts())

print("\nChecking for NaN values:")
print(df.isna().sum())

print("\nFeature ranges:")
for col in df.columns:
    print(f"\n{col}:")
    print(f"Min: {df[col].min()}")
    print(f"Max: {df[col].max()}")
    print(f"Unique values: {len(df[col].unique())}")

# Fix and save if needed
needs_fixing = False

# Check if has_image is all 1s
if df['has_image'].nunique() == 1:
    print("\nAll posts have images. Adding some variation...")
    # Randomly set 10% of posts to no image
    random_indices = np.random.choice(len(df), size=int(len(df)*0.1), replace=False)
    df.loc[random_indices, 'has_image'] = 0
    needs_fixing = True

if needs_fixing:
    # Save fixed version
    new_file = 'ml/training_data/processed_features_gucci_fixed_v2.csv'
    df.to_csv(new_file, index=False)
    print(f"\nSaved fixed data to: {new_file}")
else:
    print("\nNo fixes needed!") 